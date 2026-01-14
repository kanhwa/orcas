"""align report_type enum to uppercase canonical values

Revision ID: 20260115_align_report_type_uppercase
Revises: 20260114_add_report_type_scoring_ranking
Create Date: 2026-01-14

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "20260115_align_report_type_uppercase"
down_revision: Union[str, Sequence[str], None] = "20260114_add_report_type_scoring_ranking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UPPER_TYPES = "('ANALYSIS_SCREENING', 'ANALYSIS_METRIC_RANKING', 'SCORING_RANKING', 'SCORING_SCORECARD', 'COMPARE_STOCKS', 'COMPARE_HISTORICAL', 'SIMULATION_SCENARIO')"
LOWER_TYPES = "('analysis_screening', 'analysis_metric_ranking', 'scoring_ranking', 'scoring_scorecard', 'compare_stocks', 'compare_historical', 'simulation_scenario')"


def upgrade() -> None:
    # Create new enum with uppercase values
    op.execute(f"CREATE TYPE report_type_new AS ENUM {UPPER_TYPES}")

    # Migrate column to new enum (uppercasing existing rows)
    op.execute(
        """
        ALTER TABLE reports
        ALTER COLUMN type TYPE report_type_new
        USING UPPER(type::text)::report_type_new;
        """
    )

    # Swap types: rename old to *_old, rename new to canonical name, drop old
    op.execute("ALTER TYPE report_type RENAME TO report_type_old")
    op.execute("ALTER TYPE report_type_new RENAME TO report_type")
    op.execute("DROP TYPE report_type_old")


def downgrade() -> None:
    # Recreate lowercase enum
    op.execute(f"CREATE TYPE report_type_new AS ENUM {LOWER_TYPES}")

    # Convert data back to lowercase enum
    op.execute(
        """
        ALTER TABLE reports
        ALTER COLUMN type TYPE report_type_new
        USING LOWER(type::text)::report_type_new;
        """
    )

    # Swap back
    op.execute("ALTER TYPE report_type RENAME TO report_type_old")
    op.execute("ALTER TYPE report_type_new RENAME TO report_type")
    op.execute("DROP TYPE report_type_old")
