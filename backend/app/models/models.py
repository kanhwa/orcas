# backend/app/models/models.py
# pylint: disable=not-callable
import enum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey,
    Numeric, UniqueConstraint, Enum, func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    employee = "employee"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class MetricSection(str, enum.Enum):
    cashflow = "cashflow"
    balance = "balance"
    income = "income"


class MetricType(str, enum.Enum):
    benefit = "benefit"
    cost = "cost"


class ImportStatus(str, enum.Enum):
    success = "success"
    failed = "failed"
    rolled_back = "rolled_back"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(100), nullable=True)
    first_name = Column(String(50), nullable=True)
    middle_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    full_name = Column(String(100), nullable=True)  # Legacy, computed from first/middle/last
    role = Column(Enum(UserRole, name="user_role"), nullable=False, server_default=UserRole.employee.value)
    status = Column(Enum(UserStatus, name="user_status"), nullable=False, server_default=UserStatus.active.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    scoring_templates = relationship("ScoringTemplate", back_populates="user")
    import_history = relationship("ImportHistory", back_populates="user")
    
    @property
    def computed_full_name(self) -> str:
        """Compute full name from first, middle, last names."""
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p) or self.username


class Emiten(Base):
    __tablename__ = "emitens"

    id = Column(Integer, primary_key=True)
    ticker_code = Column(String(10), unique=True, nullable=False)
    bank_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    financial_data = relationship("FinancialData", back_populates="emiten")


class MetricDefinition(Base):
    __tablename__ = "metric_definitions"

    id = Column(Integer, primary_key=True)
    metric_name = Column(String(100), nullable=False)
    section = Column(Enum(MetricSection, name="metric_section"), nullable=False)
    # type dan value_type jangan dipaksa dulu (biar tidak "ngarang" sebelum mapping final Anda dikunci)
    type = Column(Enum(MetricType, name="metric_type"), nullable=True)
    default_weight = Column(Numeric(5, 2), nullable=True)
    description = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("section", "metric_name", name="uq_metric_section_name"),
    )

    financial_data = relationship("FinancialData", back_populates="metric")


class FinancialData(Base):
    __tablename__ = "financial_data"

    id = Column(Integer, primary_key=True)
    emiten_id = Column(Integer, ForeignKey("emitens.id", ondelete="CASCADE"), nullable=False)
    metric_id = Column(Integer, ForeignKey("metric_definitions.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    value = Column(Numeric(20, 4), nullable=True)  # bisa null sesuai dataset
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("emiten_id", "metric_id", "year", name="uq_financial_emiten_metric_year"),
    )

    emiten = relationship("Emiten", back_populates="financial_data")
    metric = relationship("MetricDefinition", back_populates="financial_data")


class ScoringTemplate(Base):
    __tablename__ = "scoring_templates"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    metrics_config = Column(JSONB, nullable=False)  # simpan bobot & pilihan metric
    visibility = Column(String(10), nullable=False, server_default="private")
    version = Column(Integer, nullable=False, server_default="1")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="scoring_templates")


class ImportHistory(Base):
    __tablename__ = "import_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    file_name = Column(String(255), nullable=False)
    year_imported = Column(Integer, nullable=False)
    rows_added = Column(Integer, nullable=False, server_default="0")
    status = Column(Enum(ImportStatus, name="import_status"), nullable=False, server_default=ImportStatus.success.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="import_history")


class ScoringResult(Base):
    __tablename__ = "scoring_results"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(Integer, ForeignKey("scoring_templates.id", ondelete="SET NULL"), nullable=True)
    year = Column(Integer, nullable=False)
    request = Column(JSONB, nullable=False)
    ranking = Column(JSONB, nullable=False)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    request = Column(JSONB, nullable=False)
    response = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SimulationLog(Base):
    __tablename__ = "simulation_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    request = Column(JSONB, nullable=False)
    response = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ScoringRun(Base):
    __tablename__ = "scoring_runs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(Integer, ForeignKey("scoring_templates.id", ondelete="SET NULL"), nullable=True)
    year = Column(Integer, nullable=False)
    request = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    items = relationship("ScoringRunItem", back_populates="run", cascade="all, delete-orphan")


class ScoringRunItem(Base):
    __tablename__ = "scoring_run_items"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("scoring_runs.id", ondelete="CASCADE"), nullable=False)
    emiten_id = Column(Integer, ForeignKey("emitens.id", ondelete="CASCADE"), nullable=False)
    score = Column(Numeric(12, 6), nullable=False)
    rank = Column(Integer, nullable=False)
    breakdown = Column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint("run_id", "emiten_id", name="uq_scoring_run_emiten"),
        UniqueConstraint("run_id", "rank", name="uq_scoring_run_rank"),
    )

    run = relationship("ScoringRun", back_populates="items")
