from pydantic import BaseModel, Field
from typing import List, Optional, Any

class SimulationAdjustmentPayload(BaseModel):
    metric: str
    adjustment_percent: str
    baseline_value: Optional[float]
    simulated_value: Optional[float]

class SimulationInterpretationRequest(BaseModel):
    emiten: str
    weight_profile: str
    baseline_score: float
    simulated_score: float
    delta: float
    delta_percent: float
    adjustments: List[SimulationAdjustmentPayload]
