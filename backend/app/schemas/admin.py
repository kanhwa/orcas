from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    role: str
    status: str
    created_at: str

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    total: int
    users: List[UserOut]


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=100)
    role: Optional[Literal["admin", "user"]] = None
    status: Optional[Literal["active", "inactive"]] = None
