"""add avatar_url to users

Revision ID: 20260109_add_avatar_url
Revises: 20260107displayen
Create Date: 2026-01-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260109_add_avatar_url"
down_revision: Union[str, Sequence[str], None] = "20260107displayen"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
