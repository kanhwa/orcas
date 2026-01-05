#!/usr/bin/env python3
"""Seed (upsert) metric definitions from a CSV mapping file.

This script makes the UI dropdown catalog deterministic by ensuring `metric_definitions`
contains the full metric list with section + benefit/cost type + default_weight.

Expected CSV header (see data/processed/metric_type_mapping.csv):
    id,section,metric_name,type,default_weight

Usage:
    python -m app.scripts.seed_metric_definitions \
      --csv ../data/processed/metric_type_mapping.csv

Notes:
- Uses UPSERT on (section, metric_name).
- Ignores the CSV `id` column (DB uses its own PK).
"""

from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import text

from app.db.session import SessionLocal

ALLOWED_SECTIONS = {"cashflow", "balance", "income"}
ALLOWED_TYPES = {"benefit", "cost"}


@dataclass(frozen=True)
class MetricRow:
    section: str
    metric_name: str
    metric_type: str | None
    default_weight: Decimal | None


def _parse_decimal(raw: str) -> Decimal | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return None


def read_mapping(csv_path: Path) -> list[MetricRow]:
    with csv_path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required = {"section", "metric_name"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")

        rows: list[MetricRow] = []
        for i, row in enumerate(reader, start=2):
            section = (row.get("section") or "").strip().lower()
            metric_name = (row.get("metric_name") or "").strip()
            metric_type = (row.get("type") or "").strip().lower() or None
            default_weight = _parse_decimal(row.get("default_weight") or "")

            if not section or not metric_name:
                continue
            if section not in ALLOWED_SECTIONS:
                raise ValueError(f"Invalid section '{section}' at line {i}")
            if metric_type is not None and metric_type not in ALLOWED_TYPES:
                raise ValueError(f"Invalid type '{metric_type}' at line {i}")

            rows.append(
                MetricRow(
                    section=section,
                    metric_name=metric_name,
                    metric_type=metric_type,
                    default_weight=default_weight,
                )
            )

    # de-duplicate by (section, metric_name) keeping last occurrence
    dedup: dict[tuple[str, str], MetricRow] = {}
    for r in rows:
        dedup[(r.section, r.metric_name)] = r
    return list(dedup.values())


def upsert_metrics(db, rows: list[MetricRow]) -> tuple[int, int]:
    """Returns (inserted_or_updated, skipped)."""
    upsert_sql = text(
        """
        INSERT INTO metric_definitions (metric_name, section, type, default_weight, description)
        VALUES (:metric_name, :section, :type, :default_weight, NULL)
        ON CONFLICT (section, metric_name)
        DO UPDATE SET
            type = EXCLUDED.type,
            default_weight = EXCLUDED.default_weight
        """
    )

    applied = 0
    skipped = 0

    for r in rows:
        # Optional: enforce non-negative weights if provided
        if r.default_weight is not None and r.default_weight < 0:
            skipped += 1
            continue

        db.execute(
            upsert_sql,
            {
                "metric_name": r.metric_name,
                "section": r.section,
                "type": r.metric_type,
                "default_weight": r.default_weight,
            },
        )
        applied += 1

    return applied, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed metric_definitions from CSV mapping")
    parser.add_argument(
        "--csv",
        type=str,
        default="../data/processed/metric_type_mapping.csv",
        help="Path to metric_type_mapping.csv (default: ../data/processed/metric_type_mapping.csv)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and validate only; do not write to DB",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv).resolve()
    if not csv_path.is_file():
        print(f"ERROR: CSV not found: {csv_path}", file=sys.stderr)
        return 1

    try:
        rows = read_mapping(csv_path)
    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"ERROR parsing CSV: {e}", file=sys.stderr)
        return 1

    if not rows:
        print("ERROR: No valid metric rows found in CSV", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"OK (dry-run): parsed {len(rows)} metric row(s) from {csv_path.name}")
        return 0

    db = SessionLocal()
    try:
        applied, skipped = upsert_metrics(db, rows)
        db.commit()
        print(f"Seeded metric_definitions: applied={applied}, skipped={skipped}")
        return 0
    except Exception as e:  # pylint: disable=broad-exception-caught
        db.rollback()
        print(f"ERROR writing to DB: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
