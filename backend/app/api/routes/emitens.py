from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import Emiten, User
from app.schemas.emitens import EmitensListResponse, EmitenOut

router = APIRouter(prefix="/api/emitens", tags=["emitens"])


@router.get("", response_model=EmitensListResponse)
def list_emitens(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> EmitensListResponse:
    emitens = db.query(Emiten).order_by(Emiten.ticker_code.asc()).all()
    return EmitensListResponse(
        items=[EmitenOut(ticker_code=e.ticker_code, bank_name=e.bank_name) for e in emitens]
    )
