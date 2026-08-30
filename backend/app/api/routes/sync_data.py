from __future__ import annotations

import csv
import re
import io
import os
import shutil
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert

from app.api.deps import get_current_user, get_db
from app.models import User, UserRole, Emiten, MetricDefinition, FinancialData, ImportHistory, ImportStatus
from app.core.audit import log_audit

router = APIRouter(prefix="/api/sync-data", tags=["sync-data"])

# Path to processed data folder
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "processed")
DATA_DIR = os.path.abspath(DATA_DIR)

# Path to trash folder
TRASH_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "trash")
TRASH_DIR = os.path.abspath(TRASH_DIR)
os.makedirs(TRASH_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)


# Allowed year range
MIN_YEAR = 2010
MAX_YEAR = 2030


class CsvFileInfo(BaseModel):
    filename: str
    year: Optional[int]
    size: int
    modified_at: str


class CsvListResponse(BaseModel):
    total: int
    files: List[CsvFileInfo]


class UploadResponse(BaseModel):
    success: bool
    filename: str
    message: str
    rows_imported: int = 0
    rows_updated: int = 0
    warning: Optional[str] = None


class ValidationError(BaseModel):
    invalid_tickers: List[str] = []
    invalid_metrics: List[str] = []
    invalid_rows: List[str] = []


class ImportResponse(BaseModel):
    success: bool
    year: int
    rows_added: int
    rows_updated: int
    message: str


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures current user is admin."""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def extract_year_from_filename(filename: str) -> Optional[int]:
    """Try to extract year from filename like 2024.csv."""
    try:
        name_without_ext = filename.rsplit(".", 1)[0]
        year = int(name_without_ext)
        if MIN_YEAR <= year <= MAX_YEAR:
            return year
    except (ValueError, IndexError):
        pass
    return None



@router.get("/stats")
def get_sync_stats(db: Session = Depends(get_db)):
    from app.models import Emiten, MetricDefinition, FinancialData
    
    total_banks = db.query(func.count(Emiten.id)).scalar() or 0
    total_metrics = db.query(func.count(MetricDefinition.id)).scalar() or 0
    total_sections = db.query(func.count(func.distinct(MetricDefinition.section))).scalar() or 0
    
    total_years = db.query(func.count(func.distinct(FinancialData.year))).scalar() or 0
    expected_cells = total_banks * total_metrics * total_years
    actual_cells = db.query(func.count(FinancialData.id)).filter(FinancialData.value.isnot(None)).scalar() or 0
    total_missing = expected_cells - actual_cells if expected_cells > actual_cells else 0
    
    return {
        "total_banks": total_banks,
        "total_metrics": total_metrics,
        "total_sections": total_sections,
        "total_years": total_years,
        "total_expected_cells": expected_cells,
        "total_missing": total_missing
    }

@router.get("/files", response_model=CsvListResponse)

def list_csv_files(
    _admin: User = Depends(require_admin),
) -> CsvListResponse:
    """
    List all CSV files in the processed data folder (admin only).
    """
    if not os.path.exists(DATA_DIR):
        return CsvListResponse(total=0, files=[])
    
    files = []
    for filename in os.listdir(DATA_DIR):
        if filename.endswith(".csv"):
            filepath = os.path.join(DATA_DIR, filename)
            stat = os.stat(filepath)
            files.append(CsvFileInfo(
                filename=filename,
                year=extract_year_from_filename(filename),
                size=stat.st_size,
                modified_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
            ))
    
    # Sort by year (if available) or filename
    files.sort(key=lambda f: (f.year or 0, f.filename))
    
    return CsvListResponse(total=len(files), files=files)


@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    request: Request,
    file: UploadFile = File(...),
    year: Optional[int] = Form(None),
    import_to_db: bool = Form(False),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    """
    Upload a CSV file to the processed data folder (admin only).
    
    Parameters:
    - file: CSV file to upload
    - year: Year for the data (optional if filename is YYYY.csv)
    - import_to_db: If True, validate and import data to database
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided",
        )
    
    if not re.match(r"^\d{4}\.csv$", file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="[ERR-02] Naming Format: File must be named exactly as YYYY.csv (e.g., 2014.csv).",
        )
        
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="[ERR-03] File Type: Only .csv files are allowed.",
        )
    
    # Determine year from filename or parameter
    file_year = extract_year_from_filename(file.filename)
    target_year = year or file_year
    
    if not (MIN_YEAR <= target_year <= MAX_YEAR):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Year must be between {MIN_YEAR} and {MAX_YEAR}",
        )
        
    # ERR-01 Duplicate File Check
    import os
    target_filename = f"{target_year}.csv"
    filepath = os.path.join(DATA_DIR, target_filename)
    if os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="[ERR-01] Duplicate File: File with this year already exists on the server. Please delete it first.",
        )
    
    # Read file content
    try:
        raw_content = await file.read()
        if len(raw_content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="[ERR-04] Oversize: File exceeds the 5MB limit.",
            )
        content_str = raw_content.decode("utf-8")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}",
        )
    
    rows_added = 0
    rows_updated = 0
    warning_msg = None
    
    # If import_to_db is True, validate and import to database
    if import_to_db:
        result = validate_and_import_csv(db, content_str, target_year, admin, request)
        rows_added = result.get("rows_added", 0)
        rows_updated = result.get("rows_updated", 0)
        warning_msg = result.get("warning")
    
    # Save file to disk
    os.makedirs(DATA_DIR, exist_ok=True)
    target_filename = f"{target_year}.csv"
    filepath = os.path.join(DATA_DIR, target_filename)
    
    try:
        with open(filepath, "wb") as buffer:
            buffer.write(raw_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}",
        )
    
    if import_to_db:
        message = f"Data for year {target_year} successfully imported."
    else:
        message = f"File saved as {target_filename}"
        
    return UploadResponse(
        success=True,
        filename=target_filename,
        message=message,
        rows_imported=rows_added,
        rows_updated=rows_updated,
        warning=warning_msg
    )


def validate_and_import_csv(
    db: Session,
    content: str,
    year: int,
    admin: User,
    request: Request,
) -> dict:
    """
    Validate CSV content and import to database.
    
    Expected CSV format:
    - First column: ticker_code
    - Subsequent columns: metric values (column names are metric_name)
    
    Returns dict with rows_added, rows_updated counts.
    """
    try:
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid CSV format: {str(e)}",
        )
    
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file is empty",
        )
    
    # Get the first row to determine columns
    first_row = rows[0]
    columns = list(first_row.keys())
    
    # In transposed CSV, metrics are in the 'Metric' column, and columns are Tickers
    # Skip metadata columns like Year, Section, Metric
    metadata_cols = {"year", "section", "metric"}
    ticker_cols = [c for c in columns if c.strip().lower() not in metadata_cols]
    
    # Identify the column containing the metric name
    metric_name_col = None
    for col in columns:
        if col.strip().lower() == "metric":
            metric_name_col = col
            break
            
    if metric_name_col is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file must contain a 'Metric' column",
        )
    
    # Validate tickers exist
    existing_tickers = {
        e.ticker_code: e.id 
        for e in db.query(Emiten).filter(Emiten.ticker_code.in_(ticker_cols)).all()
    }
    invalid_tickers = set(ticker_cols) - set(existing_tickers.keys())
    
    # Validate metrics exist
    metric_values = set(row[metric_name_col].strip() for row in rows if row.get(metric_name_col))
    
    # SYSTEM-WIDE OVERRIDE: Completely ignore the redundant 40th metric ('Operating Cash Flow')
    # so the system treats the CSV as if it only has exactly 39 metrics.
    metric_values = {m for m in metric_values if m.lower() != 'operating cash flow'}
    
    existing_metrics = {
        m.metric_name: m.id 
        for m in db.query(MetricDefinition).filter(MetricDefinition.metric_name.in_(metric_values)).all()
    }
    invalid_metrics = metric_values - set(existing_metrics.keys())
    
    # Explicitly ignore 'Operating Cash Flow' as it's a known redundant metric in the CSVs
    invalid_metrics = {m for m in invalid_metrics if m.lower() != 'operating cash flow'}
    
    # ERR-06 Year Contradiction
    year_col = None
    for col in columns:
        if col.strip().lower() == "year":
            year_col = col
            break
            
    if year_col:
        internal_years = set(str(row.get(year_col, "")).strip() for row in rows if str(row.get(year_col, "")).strip())
        if len(internal_years) > 1 or (len(internal_years) == 1 and internal_years.pop() != str(year)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"[ERR-06] Year Contradiction: Filename year ({year}) does not match internal year in CSV.",
            )

    # ERR-05 Structure Mismatch
    if len(ticker_cols) != 32 or len(metric_values) != 39:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"[ERR-05] Structure Mismatch: Expected 32 banks and 39 metrics, got {len(ticker_cols)} banks and {len(metric_values)} metrics.",
        )
        
    # Collect validation errors
    if invalid_tickers or invalid_metrics:
        error_parts = []
        if invalid_tickers:
            error_parts.append(f"Invalid tickers: {', '.join(sorted(invalid_tickers))}")
        if invalid_metrics:
            error_parts.append(f"Invalid metrics: {', '.join(sorted(invalid_metrics))}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=". ".join(error_parts),
        )
    
    # Import data using upsert
    rows_added = 0
    rows_updated = 0
    parsed_data = {}
    
    for row in rows:
        metric_name = row.get(metric_name_col, "").strip()
        if not metric_name or metric_name not in existing_metrics:
            continue
            
        metric_id = existing_metrics[metric_name]
        
        for ticker in ticker_cols:
            if ticker not in existing_tickers:
                continue
                
            emiten_id = existing_tickers[ticker]
            raw_value = row.get(ticker, "").strip()
            
            # Parse value
            value = None
            if raw_value and raw_value.lower() not in ("", "null", "nan", "-", "n/a"):
                try:
                    value = Decimal(raw_value.replace(",", ""))
                except (InvalidOperation, ValueError):
                    value = None
                    
            # In our strict system, we skip nulls to not populate DB with nulls
            if value is None:
                continue
            
            # Upsert using PostgreSQL ON CONFLICT
            stmt = insert(FinancialData).values(
                emiten_id=emiten_id,
                metric_id=metric_id,
                year=year,
                value=value,
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uq_financial_emiten_metric_year",
                set_={
                    "value": stmt.excluded.value,
                    "updated_at": datetime.utcnow(),
                }
            )
            
            # We store the values for clone detection
            parsed_data[(emiten_id, metric_id)] = value
            
            result = db.execute(stmt)
            if result.rowcount > 0:
                rows_updated += 1  # Simplified for speed

    db.commit()
    
    # WARN-01 Data Clone Detected
    warning_msg = None
    if len(parsed_data) > 0:
        import logging
        logger = logging.getLogger(__name__)
        
        existing_data = db.query(FinancialData.year, FinancialData.emiten_id, FinancialData.metric_id, FinancialData.value).all()
        year_data = {}
        for y, e_id, m_id, v in existing_data:
            if y == year: continue # Skip the year we just inserted
            if y not in year_data:
                year_data[y] = {}
            # Round to 4 decimal places to match Numeric(20, 4) schema
            year_data[y][(e_id, m_id)] = round(float(v), 4)
            
        # Also convert parsed_data to rounded float for comparison
        parsed_data_float = {k: round(float(v), 4) for k, v in parsed_data.items()}
            
        for prev_year, p_data in year_data.items():
            if parsed_data_float == p_data:
                warning_msg = f"[WARN-01] Data Clone Detected: Data successfully imported, but the values are 100% identical to the {prev_year} dataset."
                break
        
        if warning_msg is None:
            # Debugging why it didn't match
            for prev_year, p_data in year_data.items():
                keys1 = set(parsed_data_float.keys())
                keys2 = set(p_data.keys())
                logger.warning(f"Clone Check vs {prev_year}: Length parsed={len(parsed_data_float)}, db={len(p_data)}")
                if keys1 != keys2:
                    logger.warning(f"Clone Check vs {prev_year}: Keys diff count = {len(keys1 ^ keys2)}")
                else:
                    diffs = 0
                    for k in keys1:
                        if parsed_data_float[k] != p_data[k]:
                            diffs += 1
                            if diffs <= 5:
                                logger.warning(f"Diff vs {prev_year} at {k}: parsed={parsed_data_float[k]} db={p_data[k]}")
                    logger.warning(f"Clone Check vs {prev_year}: Values diff count = {diffs}")
    
    # Create ImportHistory record
    import_record = ImportHistory(
        user_id=admin.id,
        file_name=f"{year}.csv",
        year_imported=year,
        rows_added=rows_added + rows_updated,
        status=ImportStatus.success,
    )
    db.add(import_record)
    db.commit()
    
    # Audit log
    log_audit(
        db=db,
        user_id=admin.id,
        action="data_imported",
        target_type="financial_data",
        target_id=None,
        details={
            "year": year,
            "rows_added": rows_added,
            "rows_updated": rows_updated,
            "tickers_count": len(ticker_cols),
            "metrics_count": len(metric_values),
            "file_name": f"{year}.csv",
        },
        ip_address=request.client.host if request.client else None,
    )
    
    res = {"rows_added": rows_added, "rows_updated": rows_updated}
    if warning_msg:
        res["warning"] = warning_msg
    return res


@router.delete("/files/{filename}")
def delete_csv_file(
    filename: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    """
    Delete a CSV file from the processed data folder and purge its data from the database.
    """
    from app.models import FinancialData, ImportHistory
    
    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete CSV files",
        )
    
    # Extract year from filename to purge from DB
    year = extract_year_from_filename(filename)
    
    filepath = os.path.join(DATA_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )
    
    try:
        # Move to trash instead of os.remove
        trash_path = os.path.join(TRASH_DIR, filename)
        shutil.move(filepath, trash_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )
        
    # Purge the corresponding data from the database
    if year:
        try:
            db.query(FinancialData).filter(FinancialData.year == year).delete()
            db.query(ImportHistory).filter(ImportHistory.year_imported == year).delete()
            db.commit()
        except Exception as e:
            db.rollback()
            # We don't raise error if DB delete fails, just log it, file is already gone
            print(f"Warning: Failed to purge DB data for {year}: {e}")
    
    return {"detail": f"File {filename} deleted successfully and database records purged"}


@router.get("/trash")
def list_trash_files(_admin: User = Depends(require_admin)) -> dict:
    """List all files in the trash directory."""
    files = []
    if os.path.exists(TRASH_DIR):
        for f in os.listdir(TRASH_DIR):
            if f.endswith(".csv"):
                path = os.path.join(TRASH_DIR, f)
                stat = os.stat(path)
                year = extract_year_from_filename(f)
                files.append({
                    "filename": f,
                    "year": year,
                    "size": stat.st_size,
                    "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
    return {"files": sorted(files, key=lambda x: x["filename"], reverse=True)}

@router.delete("/trash/{filename}")
def delete_trash_file(filename: str, _admin: User = Depends(require_admin)) -> dict:
    """Permanently delete a file from trash."""
    if not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Invalid file")
    
    path = os.path.join(TRASH_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found in trash")
        
    os.remove(path)
    return {"detail": f"File {filename} permanently deleted"}

@router.delete("/trash")
def empty_trash(_admin: User = Depends(require_admin)) -> dict:
    """Empty all files from trash."""
    count = 0
    if os.path.exists(TRASH_DIR):
        for f in os.listdir(TRASH_DIR):
            if f.endswith(".csv"):
                os.remove(os.path.join(TRASH_DIR, f))
                count += 1
    return {"detail": f"Emptied {count} files from trash"}

@router.post("/trash/{filename}/restore")
def restore_trash_file(
    request: Request,
    filename: str, 
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin)
) -> dict:
    """Restore a file from trash and import it back into the database."""
    if not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Invalid file")
        
    trash_path = os.path.join(TRASH_DIR, filename)
    if not os.path.exists(trash_path):
        raise HTTPException(status_code=404, detail="File not found in trash")
        
    year = extract_year_from_filename(filename)
    if not year:
        raise HTTPException(status_code=400, detail="Invalid filename format")
        
    # Read the file content BEFORE moving it (in case import fails)
    with open(trash_path, 'r', encoding='utf-8') as f:
        content_str = f.read()
        
    try:
        res = validate_and_import_csv(db, content_str, year, _admin, request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    # If import successful, move file back to processed
    processed_path = os.path.join(DATA_DIR, filename)
    shutil.move(trash_path, processed_path)
    
    return {
        "detail": f"Successfully restored and imported {filename}",
        "inserted": res.get("rows_added", 0),
        "updated": res.get("rows_updated", 0),
        "warning": res.get("warning")
    }
