"""Add English display name and unit config to metric_definitions

Revision ID: 20260107displayen
Revises: f28acd1ff73a
Create Date: 2026-01-07
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260107displayen"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "metric_definitions",
        sa.Column("display_name_en", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "metric_definitions",
        sa.Column("unit_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    conn = op.get_bind()

    name_map = {
        "Arus Kas Dari Aktivitas Investasi": "Cash Flow from Investing Activities",
        "Arus Kas Dari Aktivitas Operasi": "Cash Flow from Operating Activities",
        "Arus Kas Dari Aktivitas Pendanaan": "Cash Flow from Financing Activities",
        "Kenaikan (Penurunan) Bersih Kas dan Setara Kas": "Net Increase (Decrease) in Cash",
        "Kas Dan Setara Kas Awal Periode": "Beginning Cash and Cash Equivalents",
        "Kas Dan Setara Kas Akhir Periode": "Ending Cash and Cash Equivalents",
        "Aset Tetap": "Fixed Assets",
        "Giro Pada Bank Indonesia": "Demand Deposits at Bank Indonesia",
        "Penempatan Pada Bank Indonesia": "Placements with Bank Indonesia",
        "Pinjaman Yang Diberikan": "Loans Given",
        "Pinjaman yang Diterima": "Borrowings Received",
        "Simpanan Nasabah": "Customer Deposits",
        "Total Aset": "Total Assets",
        "Total Ekuitas": "Total Equity",
        "Total Liabilitas": "Total Liabilities",
        "Beban Pajak Penghasilan": "Income Tax Expense",
        "Beban Usaha": "Operating Expenses",
        "Jumlah Laba Komprehensif": "Total Comprehensive Income",
        "Laba Bersih Tahun Berjalan": "Net Income for the Year",
        "Laba Kotor": "Gross Profit",
        "Laba Sebelum Pajak": "Profit Before Tax",
        "Laba Usaha": "Operating Profit",
        "Pendapatan/Beban Lain-lain": "Other Income / Expense",
        "Saham Beredar (Share Outstanding)": "Shares Outstanding",
        "Total Beban Pokok Penjualan": "Cost of Revenue",
        "Total Pendapatan": "Total Revenue",
    }

    ratio_unit = {"unit": "%", "scale": "ratio", "allow_negative": True}
    multiple_unit = {"unit": "x", "scale": "ratio", "allow_negative": False}
    idr_unit = {"unit": "IDR bn", "scale": "absolute", "allow_negative": True}
    idr_nonneg = {"unit": "IDR bn", "scale": "absolute", "allow_negative": False}

    unit_map = {
        # Cashflow related (allow negative)
        "Arus Kas Dari Aktivitas Investasi": idr_unit,
        "Arus Kas Dari Aktivitas Operasi": idr_unit,
        "Arus Kas Dari Aktivitas Pendanaan": idr_unit,
        "Kenaikan (Penurunan) Bersih Kas dan Setara Kas": idr_unit,
        "Kas Dan Setara Kas Awal Periode": idr_nonneg,
        "Kas Dan Setara Kas Akhir Periode": idr_nonneg,
        "Capital expenditure": idr_unit,
        "Free cash flow": idr_unit,
        "Free cash flow per share": {"unit": "IDR", "scale": "absolute", "allow_negative": True},
        "Operating Cash Flow": idr_unit,
        # Balance sheet
        "Aset Tetap": idr_nonneg,
        "Giro Pada Bank Indonesia": idr_nonneg,
        "Penempatan Pada Bank Indonesia": idr_nonneg,
        "Pinjaman Yang Diberikan": idr_nonneg,
        "Pinjaman yang Diterima": idr_nonneg,
        "Simpanan Nasabah": idr_nonneg,
        "Total Aset": idr_nonneg,
        "Total Ekuitas": idr_nonneg,
        "Total Liabilitas": idr_nonneg,
        "Book Value Per Share (BVPS)": {"unit": "IDR", "scale": "absolute", "allow_negative": False},
        "Tangible Book Value Per Share": {"unit": "IDR", "scale": "absolute", "allow_negative": False},
        # Income statement
        "Beban Pajak Penghasilan": idr_unit,
        "Beban Usaha": idr_unit,
        "Jumlah Laba Komprehensif": idr_unit,
        "Laba Bersih Tahun Berjalan": idr_unit,
        "Laba Kotor": idr_unit,
        "Laba Sebelum Pajak": idr_unit,
        "Laba Usaha": idr_unit,
        "Pendapatan/Beban Lain-lain": idr_unit,
        "Total Beban Pokok Penjualan": idr_unit,
        "Total Pendapatan": idr_unit,
        "Earnings per Share (EPS)": {"unit": "IDR", "scale": "absolute", "allow_negative": True},
        "Saham Beredar (Share Outstanding)": {"unit": "shares", "scale": "absolute", "allow_negative": False},
        # Ratios
        "Return on Assets (ROA)": ratio_unit,
        "Return on Equity (ROE)": ratio_unit,
        "Asset Turnover": multiple_unit,
        "Price to Book Value (PBV)": multiple_unit,
        "Price to Earnings Ratio (PER)": multiple_unit,
        "Price to Sales (P/S)": multiple_unit,
    }

    # Backfill display_name_en and unit_config
    res = conn.execute(sa.text("SELECT id, metric_name FROM metric_definitions"))
    update_stmt = sa.text(
        "UPDATE metric_definitions SET display_name_en = :display, unit_config = :unit WHERE id = :id"
    ).bindparams(sa.bindparam("unit", type_=postgresql.JSONB))

    for row in res:
        name = row.metric_name
        display = name_map.get(name, name)
        unit = unit_map.get(name)
        conn.execute(update_stmt, {"display": display, "unit": unit, "id": row.id})

    op.alter_column(
        "metric_definitions",
        "display_name_en",
        existing_type=sa.String(length=150),
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column("metric_definitions", "unit_config")
    op.drop_column("metric_definitions", "display_name_en")
