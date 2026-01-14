"""create weight_templates table

Revision ID: 20260113_add_weight_templates
Revises: 20260109_add_avatar_url
Create Date: 2026-01-13

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "20260113_add_weight_templates"
down_revision: Union[str, Sequence[str], None] = "20260109_add_avatar_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if inspector.has_table("weight_templates"):
        return

    op.create_table(
        "weight_templates",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("scope", sa.String(length=20), nullable=False),
        sa.Column("weights_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("owner_user_id", "name", name="uq_weight_template_owner_name"),
    )
    op.create_index("ix_weight_templates_owner", "weight_templates", ["owner_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_weight_templates_owner", table_name="weight_templates")
    op.drop_table("weight_templates")
