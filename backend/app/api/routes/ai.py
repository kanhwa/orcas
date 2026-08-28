from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from pydantic import BaseModel
from app.services.ai_service import generate_scorecard_interpretation, generate_glossary_chat

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
