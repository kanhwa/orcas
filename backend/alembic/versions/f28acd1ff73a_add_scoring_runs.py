"""add scoring runs

Revision ID: f28acd1ff73a
Revises: 36dd5f729328
Create Date: 2026-01-06 00:39:34.872471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f28acd1ff73a'
down_revision: Union[str, Sequence[str], None] = '36dd5f729328'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "scoring_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("request", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["scoring_templates.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "scoring_run_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("emiten_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["scoring_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["emiten_id"], ["emitens.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "emiten_id", name="uq_scoring_run_emiten"),
        sa.UniqueConstraint("run_id", "rank", name="uq_scoring_run_rank"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("scoring_run_items")
    op.drop_table("scoring_runs")
