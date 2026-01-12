from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.api.deps import get_current_user, get_db
from app.models import User, WeightTemplate
from app.schemas.weight_templates import (
    WeightTemplateCreate,
    WeightTemplateListResponse,
    WeightTemplateOut,
    WeightTemplateUpdate,
)

router = APIRouter(prefix="/api/weight-templates", tags=["weight-templates"])


@router.get("", response_model=WeightTemplateListResponse)
def list_weight_templates(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeightTemplateListResponse:
    skip = max(0, skip)
    limit = max(1, min(limit, 100))

    query = db.query(WeightTemplate).filter(WeightTemplate.owner_user_id == current_user.id)
    total = query.count()
    templates = query.order_by(WeightTemplate.updated_at.desc()).offset(skip).limit(limit).all()

    return WeightTemplateListResponse(
        total=total,
        templates=[_to_out(t) for t in templates],
    )


@router.post("", response_model=WeightTemplateOut, status_code=201)
def create_weight_template(
    payload: WeightTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeightTemplateOut:
    template = WeightTemplate(
        owner_user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        scope=payload.mode,
        weights_json=payload.weights,
    )
    db.add(template)
    try:
        db.commit()
    except IntegrityError as exc:  # duplicate name per owner
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Template name already exists") from exc
    db.refresh(template)
    return _to_out(template)


@router.get("/{template_id}", response_model=WeightTemplateOut)
def get_weight_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeightTemplateOut:
    template = (
        db.query(WeightTemplate)
        .filter(WeightTemplate.id == template_id, WeightTemplate.owner_user_id == current_user.id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return _to_out(template)


@router.patch("/{template_id}", response_model=WeightTemplateOut)
def update_weight_template(
    template_id: int,
    payload: WeightTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WeightTemplateOut:
    template = (
        db.query(WeightTemplate)
        .filter(WeightTemplate.id == template_id, WeightTemplate.owner_user_id == current_user.id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if payload.name is not None:
        template.name = payload.name
    if payload.description is not None:
        template.description = payload.description
    if payload.mode is not None:
        template.scope = payload.mode
    if payload.weights is not None:
        template.weights_json = payload.weights

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Template name already exists") from exc
    db.refresh(template)
    return _to_out(template)


@router.delete("/{template_id}", status_code=204)
def delete_weight_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    template = (
        db.query(WeightTemplate)
        .filter(WeightTemplate.id == template_id, WeightTemplate.owner_user_id == current_user.id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(template)
    db.commit()


def _to_out(template: WeightTemplate) -> WeightTemplateOut:
    return WeightTemplateOut.model_validate(
        {
            "id": template.id,
            "owner_user_id": template.owner_user_id,
            "name": template.name,
            "description": template.description,
            "mode": template.scope,
            "weights": template.weights_json,
            "created_at": template.created_at,
            "updated_at": template.updated_at,
        }
    )
