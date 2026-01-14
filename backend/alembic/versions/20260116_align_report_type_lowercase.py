"""align report_type to lowercase canonical values

Revision ID: 20260116_align_report_type_lowercase
Revises: 20260115_align_report_type_uppercase
Create Date: 2026-01-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260116_align_report_type_lowercase"
down_revision: Union[str, None] = "20260115_align_report_type_uppercase"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_VALUES = (
    "analysis_screening",
    "analysis_metric_ranking",
    "scoring_ranking",
    "scoring_scorecard",
    "compare_stocks",
    "compare_historical",
    "simulation_scenario",
)

OLD_VALUES = (
    "ANALYSIS_SCREENING",
    "ANALYSIS_METRIC_RANKING",
    "SCORING_RANKING",
    "SCORING_SCORECARD",
    "COMPARE_STOCKS",
    "COMPARE_HISTORICAL",
    "SIMULATION_SCENARIO",
)


def upgrade() -> None:
    # Rename existing enum to free the name
    op.execute("ALTER TYPE report_type RENAME TO report_type_old")

    # Create the new enum with lowercase canonical values
    sa.Enum(*NEW_VALUES, name="report_type").create(op.get_bind(), checkfirst=False)

    # Alter column using a safe cast through text -> lower -> new enum
    op.execute(
        """
        ALTER TABLE reports
        ALTER COLUMN type TYPE report_type
        USING lower(type::text)::report_type
        """
    )

    # Drop the old enum now that the column uses the new type
    op.execute("DROP TYPE report_type_old")


def downgrade() -> None:
    # Recreate old enum with uppercase values
    op.execute("ALTER TYPE report_type RENAME TO report_type_new_lower")
    sa.Enum(*OLD_VALUES, name="report_type").create(op.get_bind(), checkfirst=False)

    op.execute(
        """
        ALTER TABLE reports
        ALTER COLUMN type TYPE report_type
        USING upper(type::text)::report_type
        """
    )

    op.execute("DROP TYPE report_type_new_lower")
