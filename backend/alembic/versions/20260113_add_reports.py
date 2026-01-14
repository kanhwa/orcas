"""add reports table

Revision ID: 20260113_add_reports
Revises: 20260109_add_avatar_url
Create Date: 2026-01-13

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260113_add_reports"
down_revision: Union[str, Sequence[str], None] = "20260109_add_avatar_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

report_type_enum = sa.Enum(
    "scoring_scorecard",
    "compare_stocks",
    "compare_historical",
    "simulation_scenario",
    "analysis_screening",
    "analysis_metric_ranking",
    name="report_type",
)


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("type", report_type_enum, nullable=False),
        sa.Column("pdf_data", sa.LargeBinary(), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_unique_constraint("uq_reports_owner_name", "reports", ["owner_user_id", "name"])
    op.create_index("ix_reports_owner", "reports", ["owner_user_id"])
    op.create_index("ix_reports_type", "reports", ["type"])


def downgrade() -> None:
    op.drop_index("ix_reports_type", table_name="reports")
    op.drop_index("ix_reports_owner", table_name="reports")
    op.drop_constraint("uq_reports_owner_name", "reports", type_="unique")
    op.drop_table("reports")
    report_type_enum.drop(op.get_bind(), checkfirst=True)
