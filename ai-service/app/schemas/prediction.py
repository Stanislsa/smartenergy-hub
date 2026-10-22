from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ForecastRequest(BaseModel):
    sensor_id: str = Field(..., description="Identifiant du capteur")
    horizon_minutes: int = Field(default=60, ge=1, le=1440, description="Horizon de prévision en minutes")


class ForecastResponse(BaseModel):
    sensor_id: str
    forecast_time: datetime
    horizon_minutes: int
    predicted_power_kw: float
    confidence_interval: Optional[dict] = None
    model_version: str
