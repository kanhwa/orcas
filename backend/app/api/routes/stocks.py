"""
Stock endpoints - real-time features removed
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/stocks", tags=["stocks"])
