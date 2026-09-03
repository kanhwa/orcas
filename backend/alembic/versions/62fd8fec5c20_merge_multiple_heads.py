"""merge multiple heads

Revision ID: 62fd8fec5c20
Revises: 20260116_align_report_type_lowercase, dfb697df882b
Create Date: 2026-05-17 11:18:10.130607

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '62fd8fec5c20'
down_revision: Union[str, Sequence[str], None] = ('20260116_align_report_type_lowercase', 'dfb697df882b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
