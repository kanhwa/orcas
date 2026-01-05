from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import ScoringTemplate, User
from app.schemas.templates import (
    TemplateCreate,
    TemplateListResponse,
    TemplateOut,
    TemplateUpdate,
)

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=TemplateListResponse)
def list_templates(
    skip: int = 0,
    limit: int = 20,
    mine_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TemplateListResponse:
    """
    List scoring templates.
    - mine_only=True: only user's own templates
    - mine_only=False: user's own + public templates from others
    """
    limit = max(1, min(limit, 100))
    skip = max(0, skip)

    if mine_only:
        query = db.query(ScoringTemplate).filter(ScoringTemplate.user_id == current_user.id)
    else:
        query = db.query(ScoringTemplate).filter(
            or_(
                ScoringTemplate.user_id == current_user.id,
                ScoringTemplate.visibility == "public",
            )
        )

    total = query.count()
    templates = query.order_by(ScoringTemplate.updated_at.desc()).offset(skip).limit(limit).all()

    return TemplateListResponse(
        total=total,
        templates=[_to_out(t) for t in templates],
    )


@router.post("", response_model=TemplateOut, status_code=201)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TemplateOut:
    """
    Create a new scoring template.
    """
    template = ScoringTemplate(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        metrics_config=[m.model_dump() for m in payload.metrics_config],
        visibility=payload.visibility,
        version=1,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return _to_out(template)


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TemplateOut:
    """
    Get a specific template by ID.
    User can access own templates or public templates.
    """
    template = db.query(ScoringTemplate).filter(ScoringTemplate.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if template.user_id != current_user.id and template.visibility != "public":
        raise HTTPException(status_code=403, detail="Access denied")

    return _to_out(template)


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TemplateOut:
    """
    Update a scoring template (own templates only).
    Increments version on each update.
    """
    template = (
        db.query(ScoringTemplate)
        .filter(ScoringTemplate.id == template_id, ScoringTemplate.user_id == current_user.id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found or access denied")

    if payload.name is not None:
        template.name = payload.name
    if payload.description is not None:
        template.description = payload.description
    if payload.metrics_config is not None:
        template.metrics_config = [m.model_dump() for m in payload.metrics_config]
    if payload.visibility is not None:
        template.visibility = payload.visibility

    template.version = template.version + 1
    db.commit()
    db.refresh(template)
    return _to_out(template)


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a scoring template (own templates only).
    """
    template = (
        db.query(ScoringTemplate)
        .filter(ScoringTemplate.id == template_id, ScoringTemplate.user_id == current_user.id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found or access denied")

    db.delete(template)
    db.commit()


def _to_out(t: ScoringTemplate) -> TemplateOut:
    return TemplateOut(
        id=t.id,
        user_id=t.user_id,
        name=t.name,
        description=t.description,
        metrics_config=t.metrics_config,
        visibility=t.visibility,
        version=t.version,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )
