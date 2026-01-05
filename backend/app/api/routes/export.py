from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, ScoringRun, ScoringRunItem, User

router = APIRouter(prefix="/api/export", tags=["export"])


def generate_csv(headers: List[str], rows: List[List[Any]]) -> str:
    """Generate CSV string from headers and rows."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue()


def generate_simple_pdf(title: str, headers: List[str], rows: List[List[Any]]) -> bytes:
    """
    Generate a simple text-based PDF.
    For production, use reportlab or weasyprint.
    This is a minimal implementation that creates valid PDF structure.
    """
    # Build content
    lines = [
        f"ORCAS Report: {title}",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 60,
        "",
        "  ".join(str(h).ljust(15) for h in headers),
        "-" * 60,
    ]
    for row in rows:
        lines.append("  ".join(str(cell).ljust(15) for cell in row))
    lines.append("")
    lines.append("=" * 60)
    lines.append("End of Report")
    
    content = "\n".join(lines)
    
    # Create minimal PDF
    pdf_content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length {len(content) + 100} >>
stream
BT
/F1 10 Tf
50 742 Td
12 TL
"""
    
    # Add each line
    for line in lines:
        # Escape special PDF characters
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        pdf_content += f"({escaped}) Tj T*\n"
    
    pdf_content += """ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
"""
    pdf_content += str(len(pdf_content) + 20)
    pdf_content += "\n%%EOF"
    
    return pdf_content.encode("latin-1")


@router.get("/scoring/{run_id}")
def export_scoring_run(
    run_id: int,
    format: str = Query(default="csv", description="Export format: csv, json, pdf"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    Export a scoring run to CSV, JSON, or PDF.
    """
    run = (
        db.query(ScoringRun)
        .filter(ScoringRun.id == run_id, ScoringRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Scoring run not found")

    # Get items with ticker codes
    items = (
        db.query(ScoringRunItem, Emiten.ticker_code)
        .join(Emiten, ScoringRunItem.emiten_id == Emiten.id)
        .filter(ScoringRunItem.run_id == run_id)
        .order_by(ScoringRunItem.rank)
        .all()
    )

    if format == "json":
        data = {
            "run_id": run.id,
            "year": run.year,
            "created_at": run.created_at.isoformat(),
            "ranking": [
                {"rank": item.rank, "ticker": ticker, "score": float(item.score)}
                for item, ticker in items
            ],
        }
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=scoring_run_{run_id}.json"},
        )

    headers = ["Rank", "Ticker", "Score"]
    rows = [[item.rank, ticker, f"{float(item.score):.6f}"] for item, ticker in items]

    if format == "pdf":
        pdf_bytes = generate_simple_pdf(f"Scoring Run #{run_id} - Year {run.year}", headers, rows)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=scoring_run_{run_id}.pdf"},
        )

    # Default: CSV
    csv_content = generate_csv(headers, rows)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=scoring_run_{run_id}.csv"},
    )


@router.get("/scoring-runs")
def export_all_scoring_runs(
    format: str = Query(default="csv", description="Export format: csv, json"),
    year: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    Export summary of all user's scoring runs.
    """
    query = db.query(ScoringRun).filter(ScoringRun.user_id == current_user.id)
    if year:
        query = query.filter(ScoringRun.year == year)
    runs = query.order_by(ScoringRun.created_at.desc()).all()

    if format == "json":
        data = [
            {
                "id": r.id,
                "year": r.year,
                "template_id": r.template_id,
                "created_at": r.created_at.isoformat(),
            }
            for r in runs
        ]
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=scoring_runs.json"},
        )

    headers = ["ID", "Year", "Template ID", "Created At"]
    rows = [
        [r.id, r.year, r.template_id or "-", r.created_at.strftime("%Y-%m-%d %H:%M")]
        for r in runs
    ]
    csv_content = generate_csv(headers, rows)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=scoring_runs.csv"},
    )
