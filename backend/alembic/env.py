# backend/alembic/env.py
from __future__ import annotations

import os
import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from dotenv import load_dotenv

# Make "backend/" importable so we can do: from app...
backend_dir = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_dir))

# Load .env from backend/ folder
load_dotenv(backend_dir / ".env")

# Build database URL from environment variables
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# Validate all required env variables are set
missing_vars = []
for var_name, var_value in [
    ("DB_HOST", DB_HOST),
    ("DB_PORT", DB_PORT),
    ("DB_NAME", DB_NAME),
    ("DB_USER", DB_USER),
    ("DB_PASSWORD", DB_PASSWORD),
]:
    if not var_value:
        missing_vars.append(var_name)

if missing_vars:
    raise ValueError(
        f"Missing required environment variables: {', '.join(missing_vars)}. "
        f"Please check your backend/.env file."
    )

db_url = f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

from app.db.base import Base  # noqa
import app.models  # noqa: F401  (ensure models are imported)

config = context.config

# Set the SQLAlchemy URL from environment variables
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
