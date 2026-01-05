#!/usr/bin/env python3
"""Seed (upsert) emitens (tickers) from a processed yearly CSV header.

The processed CSV files in data/processed/ have a wide format:
    Year,Section,Metric,TICKER1,TICKER2,...

This script reads the header, extracts ticker columns, and upserts them into
`emitens.ticker_code` so UI dropdowns and imports have a consistent catalog.

Usage:
    cd backend
    .venv/bin/python -m app.scripts.seed_emitens_from_processed_csv --csv ../data/processed/2024.csv

Notes:
- Bank names are left NULL (can be enriched later).
- Uses UPSERT on (ticker_code).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import text

from app.db.session import SessionLocal


def extract_tickers_from_header(csv_path: Path) -> list[str]:
    header = csv_path.read_text(encoding="utf-8", errors="replace").splitlines()[0]
    parts = [p.strip() for p in header.split(",") if p.strip()]
    if len(parts) < 4 or parts[0:3] != ["Year", "Section", "Metric"]:
        raise ValueError(
            f"Unexpected header format in {csv_path.name}. Expected to start with 'Year,Section,Metric,...'"
        )

    tickers = parts[3:]
    # De-duplicate while preserving order
    seen: set[str] = set()
    ordered: list[str] = []
    for t in tickers:
        if t not in seen:
            seen.add(t)
            ordered.append(t)
    return ordered


def upsert_emitens(db, tickers: list[str]) -> int:
    sql = text(
        """
        INSERT INTO emitens (ticker_code, bank_name, created_at)
        VALUES (:ticker_code, NULL, NOW())
        ON CONFLICT (ticker_code)
        DO NOTHING
        """
    )

    inserted = 0
    for ticker in tickers:
        res = db.execute(sql, {"ticker_code": ticker})
        # rowcount is 1 if inserted, 0 if conflict/do nothing
        inserted += int(getattr(res, "rowcount", 0) or 0)
    return inserted


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed emitens from processed CSV header")
    parser.add_argument(
        "--csv",
        type=str,
        default="../data/processed/2024.csv",
        help="Path to a processed yearly CSV (default: ../data/processed/2024.csv)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print tickers only; do not write to DB")
    args = parser.parse_args()

    csv_path = Path(args.csv).resolve()
    if not csv_path.is_file():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        return 1

    try:
        tickers = extract_tickers_from_header(csv_path)
    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"OK (dry-run): {len(tickers)} tickers from {csv_path.name}:")
        print(",".join(tickers))
        return 0

    db = SessionLocal()
    try:
        inserted = upsert_emitens(db, tickers)
        db.commit()
        print(f"Seeded emitens: total_in_csv={len(tickers)}, inserted={inserted}")
        return 0
    except Exception as e:  # pylint: disable=broad-exception-caught
        db.rollback()
        print(f"ERROR writing to DB: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
