"""
Stock data schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StockResponse(BaseModel):
    """Real-time stock data response"""
    ticker: str  # e.g., "BBCA"
    name: str  # Bank name
    price: float  # Current price
    change: float  # Price change (value)
    changePercent: float  # Price change (percentage)
    volume: int  # Trading volume
    marketCap: Optional[float] = None  # Market capitalization
    status: str  # "open" or "closed" (BEI market status)
    lastUpdate: str  # ISO timestamp
    disclaimer: str  # Disclaimer text

    class Config:
        json_schema_extra = {
            "example": {
                "ticker": "BBCA",
                "name": "Bank Central Asia",
                "price": 7100.0,
                "change": 50.0,
                "changePercent": 0.71,
                "volume": 15000000,
                "marketCap": 2500000000000,
                "status": "open",
                "lastUpdate": "2025-01-06T10:30:00+00:00",
                "disclaimer": "Harga bersifat informatif dan bukan rekomendasi investasi..."
            }
        }


class StockListResponse(BaseModel):
    """List of all stocks"""
    stocks: list[StockResponse]
    count: int
    marketStatus: str  # "open" or "closed"
