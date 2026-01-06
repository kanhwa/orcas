from __future__ import annotations

import csv
import io
import os
import shutil
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from app.api.deps import get_current_user, get_db
from app.models import User, UserRole, Emiten, MetricDefinition, FinancialData, ImportHistory, ImportStatus
from app.core.audit import log_audit

router = APIRouter(prefix="/api/sync-data", tags=["sync-data"])

# Path to processed data folder
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "processed")
DATA_DIR = os.path.abspath(DATA_DIR)

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
) -> UploadResponse:
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
    
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file",
        )
    
    # Determine year from filename or parameter
    file_year = extract_year_from_filename(file.filename)
    target_year = year or file_year
    
    if target_year is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Year must be specified. Either use YYYY.csv filename format or provide year parameter ({MIN_YEAR}-{MAX_YEAR})",
        )
    
    if not (MIN_YEAR <= target_year <= MAX_YEAR):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Year must be between {MIN_YEAR} and {MAX_YEAR}",
        )
    
    # Read file content
    try:
        content = await file.read()
        content_str = content.decode("utf-8")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}",
        )
    
    rows_added = 0
    rows_updated = 0
    
    # If import_to_db is True, validate and import to database
    if import_to_db:
        result = validate_and_import_csv(db, content_str, target_year, admin, request)
        rows_added = result["rows_added"]
        rows_updated = result["rows_updated"]
    
    # Save file to disk
    os.makedirs(DATA_DIR, exist_ok=True)
    target_filename = f"{target_year}.csv"
    filepath = os.path.join(DATA_DIR, target_filename)
    
    try:
        with open(filepath, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}",
        )
    
    message = f"File saved as {target_filename}"
    if import_to_db:
        message += f". Imported {rows_added} new rows, updated {rows_updated} existing rows."
    
    return UploadResponse(
        success=True,
        filename=target_filename,
        message=message,
        rows_imported=rows_added,
        rows_updated=rows_updated,
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
    
    # Find ticker column (first column or 'ticker' or 'ticker_code')
    ticker_col = None
    for col in ["ticker", "ticker_code", "Ticker", "TICKER"]:
        if col in columns:
            ticker_col = col
            break
    if ticker_col is None:
        ticker_col = columns[0]  # Assume first column is ticker
    
    # Metric columns are all columns except ticker
    metric_cols = [c for c in columns if c != ticker_col and c.strip()]
    
    # Validate tickers exist
    ticker_values = set(row[ticker_col].strip().upper() for row in rows if row[ticker_col])
    existing_tickers = {
        e.ticker_code: e.id 
        for e in db.query(Emiten).filter(Emiten.ticker_code.in_(ticker_values)).all()
    }
    invalid_tickers = ticker_values - set(existing_tickers.keys())
    
    # Validate metrics exist
    existing_metrics = {
        m.metric_name: m.id 
        for m in db.query(MetricDefinition).filter(MetricDefinition.metric_name.in_(metric_cols)).all()
    }
    invalid_metrics = set(metric_cols) - set(existing_metrics.keys())
    
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
    
    for row in rows:
        ticker = row[ticker_col].strip().upper()
        if ticker not in existing_tickers:
            continue
        
        emiten_id = existing_tickers[ticker]
        
        for metric_name in metric_cols:
            if metric_name not in existing_metrics:
                continue
            
            metric_id = existing_metrics[metric_name]
            raw_value = row.get(metric_name, "").strip()
            
            # Parse value
            value = None
            if raw_value and raw_value.lower() not in ("", "null", "nan", "-", "n/a"):
                try:
                    value = Decimal(raw_value.replace(",", ""))
                except (InvalidOperation, ValueError):
                    value = None
            
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
            
            result = db.execute(stmt)
            if result.rowcount > 0:
                # Check if it was insert or update (rough heuristic)
                existing = db.query(FinancialData).filter(
                    FinancialData.emiten_id == emiten_id,
                    FinancialData.metric_id == metric_id,
                    FinancialData.year == year,
                ).first()
                if existing and existing.created_at == existing.updated_at:
                    rows_added += 1
                else:
                    rows_updated += 1
    
    db.commit()
    
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
            "tickers_count": len(ticker_values),
            "metrics_count": len(metric_cols),
        },
        ip_address=request.client.host if request.client else None,
    )
    
    return {"rows_added": rows_added, "rows_updated": rows_updated}


@router.delete("/files/{filename}")
def delete_csv_file(
    filename: str,
    _admin: User = Depends(require_admin),
) -> dict:
    """
    Delete a CSV file from the processed data folder (admin only).
    """
    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete CSV files",
        )
    
    filepath = os.path.join(DATA_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )
    
    try:
        os.remove(filepath)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )
    
    return {"detail": f"File {filename} deleted successfully"}
