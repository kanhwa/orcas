from __future__ import annotations

import base64
import io
import logging
import re
import urllib.parse
from typing import Dict, Iterable, List

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pypdf import PdfReader, PdfWriter

from app.api.deps import get_current_user, get_db
from app.models import Report, ReportType, User
from app.schemas.reports import (
    ReportCombineRequest,
    ReportCreate,
    ReportDetail,
    ReportListItem,
    ReportListResponse,
    ReportRename,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])

logger = logging.getLogger(__name__)


def _to_detail(report: Report) -> ReportDetail:
    return ReportDetail(
        id=report.id,
        name=report.name,
        type=report.type.value if isinstance(report.type, ReportType) else str(report.type),
        metadata=report.metadata_json,
        created_at=report.created_at,
        owner_user_id=report.owner_user_id,
    )


def _to_list_item(report: Report) -> ReportListItem:
    return ReportListItem(
        id=report.id,
        name=report.name,
        type=report.type.value if isinstance(report.type, ReportType) else str(report.type),
        metadata=report.metadata_json,
        created_at=report.created_at,
    )


def _decode_pdf(pdf_base64: str) -> bytes:
    try:
        data = base64.b64decode(pdf_base64, validate=True)
    except Exception as exc:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid pdf_base64") from exc
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF content is empty")
    return data


def _get_owned_or_404(report_id: int, db: Session, current_user: User) -> Report:
    report = db.query(Report).filter(Report.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if report.owner_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return report


def _validate_type(raw_type: str | None) -> ReportType | None:
    if raw_type is None:
        return None
    try:
        return ReportType(raw_type.strip().lower())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid report type") from exc


def _merge_pdfs(reports: Iterable[Report]) -> bytes:
    writer = PdfWriter()
    for report in reports:
        reader = PdfReader(io.BytesIO(report.pdf_data))
        for page in reader.pages:
            writer.add_page(page)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def _sanitize_ascii_filename_base(raw_name: str, fallback: str) -> str:
    base = re.sub(r"\.pdf$", "", raw_name, flags=re.IGNORECASE)
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("_")
    return base or fallback


def _build_content_disposition(report_id: int, raw_name: str | None, inline: bool = False) -> str:
    raw = raw_name or f"report_{report_id}"
    ascii_base = _sanitize_ascii_filename_base(raw, f"report_{report_id}")
    ascii_filename = f"{ascii_base}.pdf"
    utf8_filename = f"{raw}.pdf"
    encoded = urllib.parse.quote(utf8_filename, safe="")
    disposition_type = "inline" if inline else "attachment"
    return f"{disposition_type}; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded}"


@router.post("", response_model=ReportDetail, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportDetail:
    pdf_bytes = _decode_pdf(payload.pdf_base64)
    report = Report(
        owner_user_id=current_user.id,
        name=payload.name,
        type=ReportType(payload.type),
        pdf_data=pdf_bytes,
        metadata_json=payload.metadata,
    )
    db.add(report)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report name already exists") from exc
    db.refresh(report)
    return _to_detail(report)


@router.get("", response_model=ReportListResponse)
def list_reports(
    report_type: str | None = Query(default=None, description="Filter by report type"),
    q: str | None = Query(default=None, description="Search by name"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportListResponse:
    skip = max(0, skip)
    limit = max(1, min(100, limit))

    type_filter = _validate_type(report_type)

    query = db.query(Report).filter(Report.owner_user_id == current_user.id)
    if type_filter:
        query = query.filter(Report.type == type_filter)
    if q:
        query = query.filter(Report.name.ilike(f"%{q}%"))

    total = query.count()
    rows = query.order_by(Report.created_at.desc(), Report.id.desc()).offset(skip).limit(limit).all()

    return ReportListResponse(total=total, items=[_to_list_item(r) for r in rows])


@router.get("/{report_id}", response_model=ReportDetail)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportDetail:
    report = _get_owned_or_404(report_id, db, current_user)
    return _to_detail(report)


@router.get("/{report_id}/pdf")
def download_report_pdf(
    report_id: int,
    inline: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    report = _get_owned_or_404(report_id, db, current_user)
    pdf_bytes = report.pdf_data or b""
    if not pdf_bytes:
        logger.warning("Report PDF missing", extra={"report_id": report.id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")
    logger.info(
        "Sending report PDF",
        extra={"report_id": report.id, "bytes": len(pdf_bytes)},
    )
    content_disposition = _build_content_disposition(report.id, report.name, inline)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": content_disposition,
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.patch("/{report_id}", response_model=ReportDetail)
def rename_report(
    report_id: int,
    payload: ReportRename,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportDetail:
    report = _get_owned_or_404(report_id, db, current_user)
    report.name = payload.name
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report name already exists") from exc
    db.refresh(report)
    return _to_detail(report)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    report = _get_owned_or_404(report_id, db, current_user)
    db.delete(report)
    db.commit()


@router.post("/combine", response_model=ReportDetail, status_code=status.HTTP_201_CREATED)
def combine_reports(
    payload: ReportCombineRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportDetail:
    ids = payload.ordered_report_ids

    existing = db.query(Report).filter(Report.id.in_(ids)).all()
    if len(existing) != len(ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more reports not found")

    unauthorized = [r.id for r in existing if r.owner_user_id != current_user.id]
    if unauthorized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    ordered_map: Dict[int, Report] = {r.id: r for r in existing}
    ordered_reports: List[Report] = [ordered_map[i] for i in ids]

    try:
        merged_pdf = _merge_pdfs(ordered_reports)
    except Exception as exc:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to merge PDFs") from exc

    new_report = Report(
        owner_user_id=current_user.id,
        name=payload.name,
        type=ordered_reports[0].type,
        pdf_data=merged_pdf,
        metadata_json={"source_ids": ids},
    )

    for report in ordered_reports:
        db.delete(report)
    db.add(new_report)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report name already exists") from exc
    db.refresh(new_report)
    return _to_detail(new_report)
