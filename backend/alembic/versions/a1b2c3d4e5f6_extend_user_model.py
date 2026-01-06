"""Extend user model with first_name, middle_name, last_name, email and change role enum

Revision ID: a1b2c3d4e5f6
Revises: f28acd1ff73a
Create Date: 2026-01-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f28acd1ff73a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to users table
    op.add_column('users', sa.Column('first_name', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('middle_name', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('email', sa.String(100), nullable=True))
    
    # First, rename 'user' to 'employee' in the enum type
    op.execute("ALTER TYPE user_role RENAME VALUE 'user' TO 'employee'")


def downgrade() -> None:
    # Revert role enum change - rename 'employee' back to 'user'
    op.execute("ALTER TYPE user_role RENAME VALUE 'employee' TO 'user'")
    
    # Remove columns
    op.drop_column('users', 'email')
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'middle_name')
    op.drop_column('users', 'first_name')
