"""add scoring_ranking report type

Revision ID: 20260114_add_report_type_scoring_ranking
Revises: 20260113_add_reports
Create Date: 2026-01-14

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "20260114_add_report_type_scoring_ranking"
down_revision: Union[str, Sequence[str], None] = "20260113_add_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE report_type ADD VALUE IF NOT EXISTS 'scoring_ranking'")


def downgrade() -> None:
    # PostgreSQL enum value removal is not straightforward; leave as-is.
    pass
