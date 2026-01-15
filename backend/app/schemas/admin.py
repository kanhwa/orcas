from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    status: str
    created_at: str

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    total: int
    admin_count: int  # Track how many admins exist
    users: List[UserOut]


class UserCreateRequest(BaseModel):
    """Request to create a new user (admin only)."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    email: Optional[str] = Field(default=None, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=50)
    middle_name: Optional[str] = Field(default=None, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    role: Literal["admin", "employee"] = "employee"


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=50)
    middle_name: Optional[str] = Field(default=None, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=100)
    role: Optional[Literal["admin", "employee"]] = None
    status: Optional[Literal["active", "inactive"]] = None


class AdminCountResponse(BaseModel):
    admin_count: int
    max_admins: int = 2
    can_create_admin: bool


# =============================================================================
# Audit Log Schemas
# =============================================================================


class AuditLogOut(BaseModel):
    """Single audit log entry for API response."""
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Paginated list of audit logs."""
    logs: List[AuditLogOut]
    total: int
    page: int
    limit: int
    total_pages: int


class AuditLogFilters(BaseModel):
    """Available filter options for audit logs."""
    actions: List[str]
    target_types: List[str]
