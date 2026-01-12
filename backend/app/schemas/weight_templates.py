from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.metric_mapping_loader import load_metric_mapping_list


def _normalize_section_key(section: str) -> str:
    key = (section or "").strip().lower()
    if key in {"cashflow", "cash_flow", "cash flow"}:
        return "cash_flow"
    if key in {"balance", "balance sheet"}:
        return "balance"
    if key in {"income", "income statement"}:
        return "income"
    return key


def _load_metric_and_section_keys() -> tuple[set[str], set[str]]:
    entries = load_metric_mapping_list()
    if not entries:
        raise ValueError("metric mapping is empty; cannot validate weights")
    metric_names = {e.metric_name for e in entries}
    section_keys = {_normalize_section_key(e.section) for e in entries}
    return metric_names, section_keys


class WeightTemplateBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    mode: str = Field(
        ...,
        pattern="^(metric|section)$",
        serialization_alias="mode",
    )
    weights: Dict[str, float] = Field(
        ...,
        serialization_alias="weights",
    )

    @model_validator(mode="before")
    @classmethod
    def _coerce_aliases(cls, data):
        if isinstance(data, dict):
            if "mode" not in data and "scope" in data:
                data = {**data, "mode": data.get("scope")}
            if "weights" not in data and "weights_json" in data:
                data = {**data, "weights": data.get("weights_json")}
        return data

    @field_validator("weights")
    @classmethod
    def _validate_weights(cls, value: Dict[str, float]) -> Dict[str, float]:
        if not isinstance(value, dict):
            raise ValueError("weights must be an object")
        cleaned: Dict[str, float] = {}
        for key, raw in value.items():
            if not isinstance(raw, (int, float)):
                raise ValueError("weights must contain only numbers")
            if raw < 0 or raw > 100:
                raise ValueError("weights must be between 0 and 100")
            cleaned[key] = float(raw)
        if sum(cleaned.values()) <= 0:
            raise ValueError("weights must contain at least one positive number")
        return cleaned

    @model_validator(mode="after")
    def _validate_scope_and_keys(self):
        metric_names, section_keys = _load_metric_and_section_keys()

        if self.mode == "metric":
            unknown = [k for k in self.weights.keys() if k not in metric_names]
            if unknown:
                raise ValueError(f"Unknown metrics in weights: {', '.join(unknown)}")
        elif self.mode == "section":
            normalized: Dict[str, float] = {}
            for raw_key, val in self.weights.items():
                norm_key = _normalize_section_key(raw_key)
                if norm_key not in section_keys:
                    raise ValueError(f"Unknown sections in weights: {raw_key}")
                normalized[norm_key] = normalized.get(norm_key, 0.0) + val
            self.weights = normalized
        else:
            raise ValueError("mode must be either 'metric' or 'section'")

        if sum(self.weights.values()) <= 0:
            raise ValueError("weights must contain at least one positive number")

        return self


class WeightTemplateCreate(WeightTemplateBase):
    pass


class WeightTemplateUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    mode: Optional[str] = Field(
        default=None,
        pattern="^(metric|section)$",
        serialization_alias="mode",
    )
    weights: Optional[Dict[str, float]] = Field(
        default=None,
        serialization_alias="weights",
    )

    @model_validator(mode="before")
    @classmethod
    def _coerce_aliases(cls, data):
        if isinstance(data, dict):
            if "mode" not in data and "scope" in data:
                data = {**data, "mode": data.get("scope")}
            if "weights" not in data and "weights_json" in data:
                data = {**data, "weights": data.get("weights_json")}
        return data

    @field_validator("weights")
    @classmethod
    def _validate_weights(cls, value: Optional[Dict[str, float]]) -> Optional[Dict[str, float]]:
        if value is None:
            return None
        if not isinstance(value, dict):
            raise ValueError("weights must be an object")
        cleaned: Dict[str, float] = {}
        for key, raw in value.items():
            if not isinstance(raw, (int, float)):
                raise ValueError("weights must contain only numbers")
            if raw < 0 or raw > 100:
                raise ValueError("weights must be between 0 and 100")
            cleaned[key] = float(raw)
        if sum(cleaned.values()) <= 0:
            raise ValueError("weights must contain at least one positive number")
        return cleaned

    @model_validator(mode="after")
    def _validate_scope_and_keys(self):
        # If neither mode nor weights are provided, nothing to validate
        if self.mode is None and self.weights is None:
            return self

        metric_names, section_keys = _load_metric_and_section_keys()
        mode = self.mode

        # If only weights provided, infer mode from existing input? Require mode present.
        if mode is None:
            raise ValueError("mode is required when updating weights")

        if self.weights is None:
            return self

        if mode == "metric":
            unknown = [k for k in self.weights.keys() if k not in metric_names]
            if unknown:
                raise ValueError(f"Unknown metrics in weights: {', '.join(unknown)}")
        elif mode == "section":
            normalized: Dict[str, float] = {}
            for raw_key, val in self.weights.items():
                norm_key = _normalize_section_key(raw_key)
                if norm_key not in section_keys:
                    raise ValueError(f"Unknown sections in weights: {raw_key}")
                normalized[norm_key] = normalized.get(norm_key, 0.0) + val
            self.weights = normalized
        else:
            raise ValueError("mode must be either 'metric' or 'section'")

        if sum(self.weights.values()) <= 0:
            raise ValueError("weights must contain at least one positive number")

        return self


class WeightTemplateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: int
    owner_user_id: int
    name: str
    description: Optional[str] = None
    mode: str
    weights: Dict[str, float]
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _map_attrs(cls, data):
        if isinstance(data, dict):
            return data
        # SQLAlchemy model
        return {
            "id": getattr(data, "id", None),
            "owner_user_id": getattr(data, "owner_user_id", None),
            "name": getattr(data, "name", None),
            "description": getattr(data, "description", None),
            "mode": getattr(data, "scope", None),
            "weights": getattr(data, "weights_json", None),
            "created_at": getattr(data, "created_at", None),
            "updated_at": getattr(data, "updated_at", None),
        }


class WeightTemplateListResponse(BaseModel):
    total: int
    templates: List[WeightTemplateOut]
