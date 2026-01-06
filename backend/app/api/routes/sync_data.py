from __future__ import annotations

import os
import shutil
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User, UserRole

router = APIRouter(prefix="/api/sync-data", tags=["sync-data"])

# Path to processed data folder
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "processed")
DATA_DIR = os.path.abspath(DATA_DIR)


class CsvFileInfo(BaseModel):
    filename: str
    year: int | None
    size: int
    modified_at: str


class CsvListResponse(BaseModel):
    total: int
    files: List[CsvFileInfo]


class UploadResponse(BaseModel):
    success: bool
    filename: str
    message: str


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures current user is admin."""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def extract_year_from_filename(filename: str) -> int | None:
    """Try to extract year from filename like 2024.csv."""
    try:
        name_without_ext = filename.rsplit(".", 1)[0]
        year = int(name_without_ext)
        if 2000 <= year <= 2100:
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
    file: UploadFile = File(...),
    _admin: User = Depends(require_admin),
) -> UploadResponse:
    """
    Upload a new CSV file to the processed data folder (admin only).
    The filename should be in format YYYY.csv (e.g., 2024.csv).
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
    
    # Validate filename is in YYYY.csv format
    year = extract_year_from_filename(file.filename)
    if year is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename must be in YYYY.csv format (e.g., 2024.csv, 2025.csv)",
        )
    
    # Ensure data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Save file
    filepath = os.path.join(DATA_DIR, file.filename)
    
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}",
        )
    
    return UploadResponse(
        success=True,
        filename=file.filename,
        message=f"File {file.filename} uploaded successfully",
    )


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
