#!/usr/bin/env python3
"""
Importer for ORCAS: imports yearly CSV files from data/processed/ into PostgreSQL.

Usage:
    python -m app.scripts.import_processed_years --dir ../data/processed

CSV format expected:
    Year,Section,Metric,TICKER1,TICKER2,...
    2023,CASHFLOW STATEMENT,Operating Cash Flow,123.0,456.0,...
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Dict, List, Set, Tuple

from sqlalchemy import text

from app.db.session import SessionLocal

# Section mapping: CSV value -> internal DB enum value
SECTION_MAP: Dict[str, str] = {
    "CASHFLOW STATEMENT": "cashflow",
    "BALANCE SHEET": "balance",
    "INCOME STATEMENT": "income",
}


def parse_value(raw: str) -> float | None:
    """Convert string to float. Returns None for empty/invalid values."""
    if raw is None:
        return None
    raw = raw.strip()
    if not raw:
        return None
    try:
        return float(Decimal(raw))
    except (InvalidOperation, ValueError):
        return None


def scan_csv_files(directory: Path) -> List[Path]:
    """Scan directory for YYYY.csv files, return sorted list."""
    pattern = re.compile(r"^\d{4}\.csv$")
    files = [f for f in directory.iterdir() if f.is_file() and pattern.match(f.name)]
    files.sort(key=lambda p: int(p.stem))
    return files


def prefetch_emitens(db) -> Dict[str, int]:
    """Return dict of ticker_code -> emiten_id."""
    result = db.execute(text("SELECT id, ticker_code FROM emitens"))
    return {row.ticker_code: row.id for row in result}


def prefetch_metrics(db) -> Tuple[Dict[Tuple[str, str], int], Dict[str, int]]:
    """
    Return two dicts:
    1. (metric_name, section) -> metric_id
    2. metric_name -> metric_id (fallback, first match)
    """
    result = db.execute(text("SELECT id, metric_name, section FROM metric_definitions"))
    by_name_section: Dict[Tuple[str, str], int] = {}
    by_name: Dict[str, int] = {}
    for row in result:
        key = (row.metric_name, row.section)
        by_name_section[key] = row.id
        if row.metric_name not in by_name:
            by_name[row.metric_name] = row.id
    return by_name_section, by_name


def import_csv_file(
    db,
    csv_path: Path,
    emiten_map: Dict[str, int],
    metric_map_full: Dict[Tuple[str, str], int],
    metric_map_fallback: Dict[str, int],
) -> Tuple[int, int, int, Set[str], Set[str]]:
    """
    Import a single CSV file.
    Returns: (inserted, updated, skipped, missing_metrics, missing_tickers)
    """
    inserted = 0
    updated = 0
    skipped = 0
    missing_metrics: Set[str] = set()
    missing_tickers: Set[str] = set()

    with csv_path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        # Ticker columns = all columns except Year, Section, Metric
        ticker_columns = [h for h in headers if h not in ("Year", "Section", "Metric")]

        rows_to_upsert: List[Tuple[int, int, int, float]] = []

        for row in reader:
            year_str = row.get("Year", "").strip()
            section_raw = row.get("Section", "").strip()
            metric_name = row.get("Metric", "").strip()

            if not year_str or not section_raw or not metric_name:
                skipped += 1
                continue

            try:
                year = int(year_str)
            except ValueError:
                skipped += 1
                continue

            # Map section
            section = SECTION_MAP.get(section_raw)
            if not section:
                skipped += 1
                continue

            # Find metric_id
            metric_id = metric_map_full.get((metric_name, section))
            if metric_id is None:
                metric_id = metric_map_fallback.get(metric_name)
            if metric_id is None:
                missing_metrics.add(metric_name)
                continue

            # Process each ticker column
            for ticker in ticker_columns:
                raw_value = row.get(ticker, "")
                value = parse_value(raw_value)
                if value is None:
                    skipped += 1
                    continue

                emiten_id = emiten_map.get(ticker)
                if emiten_id is None:
                    missing_tickers.add(ticker)
                    continue

                rows_to_upsert.append((emiten_id, metric_id, year, value))

        # Batch upsert
        if rows_to_upsert:
            upsert_sql = text("""
                INSERT INTO financial_data (emiten_id, metric_id, year, value, created_at, updated_at)
                VALUES (:emiten_id, :metric_id, :year, :value, NOW(), NOW())
                ON CONFLICT (emiten_id, metric_id, year)
                DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                RETURNING (xmax = 0) AS is_insert
            """)

            for emiten_id, metric_id, year, value in rows_to_upsert:
                result = db.execute(
                    upsert_sql,
                    {"emiten_id": emiten_id, "metric_id": metric_id, "year": year, "value": value},
                )
                row = result.fetchone()
                if row and row.is_insert:
                    inserted += 1
                else:
                    updated += 1

    return inserted, updated, skipped, missing_metrics, missing_tickers


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import yearly CSV files from data/processed/ into PostgreSQL"
    )
    parser.add_argument(
        "--dir",
        type=str,
        default="../data/processed",
        help="Directory containing YYYY.csv files (default: ../data/processed)",
    )
    args = parser.parse_args()

    data_dir = Path(args.dir).resolve()
    if not data_dir.is_dir():
        print(f"ERROR: Directory not found: {data_dir}", file=sys.stderr)
        return 1

    csv_files = scan_csv_files(data_dir)
    if not csv_files:
        print(f"ERROR: No YYYY.csv files found in {data_dir}", file=sys.stderr)
        return 1

    print(f"Found {len(csv_files)} CSV file(s) to import: {[f.name for f in csv_files]}")
    print()

    db = SessionLocal()
    try:
        emiten_map = prefetch_emitens(db)
        metric_map_full, metric_map_fallback = prefetch_metrics(db)

        print(f"Prefetched {len(emiten_map)} emitens, {len(metric_map_full)} metric definitions")
        print()

        total_inserted = 0
        total_updated = 0
        total_skipped = 0
        all_missing_metrics: Set[str] = set()
        all_missing_tickers: Set[str] = set()

        for csv_path in csv_files:
            inserted, updated, skipped, missing_metrics, missing_tickers = import_csv_file(
                db, csv_path, emiten_map, metric_map_full, metric_map_fallback
            )
            db.commit()

            total_inserted += inserted
            total_updated += updated
            total_skipped += skipped
            all_missing_metrics.update(missing_metrics)
            all_missing_tickers.update(missing_tickers)

            year = csv_path.stem
            print(
                f"[{year}] inserted={inserted} updated={updated} skipped={skipped} "
                f"missing_metrics={len(missing_metrics)} missing_tickers={len(missing_tickers)}"
            )

        print()
        print("=" * 60)
        print(
            f"TOTAL: inserted={total_inserted} updated={total_updated} skipped={total_skipped}"
        )

        exit_code = 0

        if all_missing_metrics:
            sample = sorted(all_missing_metrics)[:10]
            print(f"\nWARNING: {len(all_missing_metrics)} missing metric(s) not in DB:")
            for m in sample:
                print(f"  - {m}")
            if len(all_missing_metrics) > 10:
                print(f"  ... and {len(all_missing_metrics) - 10} more")
            exit_code = 1

        if all_missing_tickers:
            sample = sorted(all_missing_tickers)[:10]
            print(f"\nWARNING: {len(all_missing_tickers)} missing ticker(s) not in DB:")
            for t in sample:
                print(f"  - {t}")
            if len(all_missing_tickers) > 10:
                print(f"  ... and {len(all_missing_tickers) - 10} more")
            exit_code = 1

        return exit_code

    except Exception as e:  # pylint: disable=broad-exception-caught
        db.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
