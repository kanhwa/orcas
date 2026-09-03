from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from pydantic import BaseModel
from app.services.ai_service import generate_scorecard_interpretation, generate_glossary_chat, generate_ranking_interpretation, generate_metric_ranking_interpretation, generate_screening_interpretation, generate_simulation_interpretation, generate_compare_interpretation, generate_historical_interpretation

router = APIRouter(prefix="/api/ai", tags=["ai"])

class ChatPayload(BaseModel):
    question: str
    history: List[str] = []
    language: str = 'English'

@router.post("/interpret-scorecard")
def interpret_scorecard(payload: Dict[str, Any]):
    """
    Generates an AI 5W+1H interpretation for a scorecard.
    """
    try:
        interpretation = generate_scorecard_interpretation(payload)
        return {"analysis": interpretation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RankingPayload(BaseModel):
    ranking_data: list
    period: str
    rank_filter_type: str = "top"
    rank_filter_count: int = 10
    language: str = "Indonesian"

@router.post("/interpret-ranking")
def interpret_ranking(payload: RankingPayload):
    try:
        analysis = generate_ranking_interpretation(
            ranking_data=payload.ranking_data, 
            period=payload.period, 
            filter_type=payload.rank_filter_type, 
            filter_count=payload.rank_filter_count, 
            language=payload.language
        )
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MetricRankingPayload(BaseModel):
    data: dict
    language: str = "English"

@router.post("/interpret-metric-ranking")
def interpret_metric_ranking(payload: MetricRankingPayload):
    try:
        analysis = generate_metric_ranking_interpretation(payload.data, payload.language)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interpret-screening")
def interpret_screening(payload: MetricRankingPayload):
    try:
        analysis = generate_screening_interpretation(payload.data, payload.language)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ask-glossary")
def ask_glossary(payload: ChatPayload):
    """
    Handles chat specifically for Basic Finance glossary.
    """
    try:
        answer = generate_glossary_chat(payload.question, payload.history, payload.language)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interpret-simulation")
def interpret_simulation(payload: MetricRankingPayload):
    try:
        analysis = generate_simulation_interpretation(payload.data, payload.language)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interpret-compare")
def interpret_compare(payload: MetricRankingPayload):
    try:
        analysis = generate_compare_interpretation(payload.data, payload.language)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interpret-historical")
def interpret_historical(payload: MetricRankingPayload):
    try:
        analysis = generate_historical_interpretation(payload.data, payload.language)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
