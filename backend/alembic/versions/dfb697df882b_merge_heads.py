"""merge heads

Revision ID: dfb697df882b
Revises: 20260112_add_weight_templates, 20260113_add_weight_templates, 20260113_add_reports
Create Date: 2026-01-13 19:11:44.576672

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dfb697df882b'
down_revision: Union[str, Sequence[str], None] = ('20260112_add_weight_templates', '20260113_add_weight_templates', '20260113_add_reports')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
