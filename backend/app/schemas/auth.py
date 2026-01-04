from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)


class UserMeResponse(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: str
    status: str
