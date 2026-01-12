from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

from app.core.config import DISABLED_METRICS


@dataclass(frozen=True)
class MetricMappingEntry:
    metric_name: str
    section: str
    type: str
    default_weight: float
    display_unit: str
    allow_negative: bool


_MAPPING_PATH = Path(__file__).resolve().parents[1] / "resources" / "metric_unit_mapping.csv"


def _parse_bool(value: str) -> bool:
    return str(value).strip().lower() == "true"


@lru_cache(maxsize=1)
def load_metric_mapping_list() -> List[MetricMappingEntry]:
    """Load and cache the metric mapping from CSV (order preserved by file)."""
    entries: List[MetricMappingEntry] = []
    with _MAPPING_PATH.open(newline="", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            metric_name = row.get("metric_name", "").strip()
            if not metric_name or metric_name in DISABLED_METRICS:
                continue

            entries.append(
                MetricMappingEntry(
                    metric_name=metric_name,
                    section=row.get("section", "").strip(),
                    type=row.get("type", "").strip(),
                    default_weight=float(row.get("default_weight", 0) or 0),
                    display_unit=row.get("display_unit", "").strip(),
                    allow_negative=_parse_bool(row.get("allow_negative", "false")),
                )
            )

    return entries


@lru_cache(maxsize=1)
def load_metric_mapping_dict() -> Dict[str, MetricMappingEntry]:
    """Convenience lookup by metric_name."""
    return {entry.metric_name: entry for entry in load_metric_mapping_list()}
