"""Placeholder migration for missing revision 7c4f86138e20

Revision ID: 7c4f86138e20
Revises: 20260109_add_avatar_url
Create Date: 2026-01-12

This migration is intentionally empty to bridge the recorded database revision
with the available history.
"""
from typing import Sequence, Union

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

revision: str = "7c4f86138e20"
down_revision: Union[str, Sequence[str], None] = "20260109_add_avatar_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
