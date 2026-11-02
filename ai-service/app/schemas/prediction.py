from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List


class ForecastRequest(BaseModel):
    sensor_id: str = Field(..., min_length=1, description="Identifiant du capteur")
    horizon_minutes: int = Field(default=60, ge=1, le=10080, description="Horizon de prévision en minutes (max 7 jours pour LSTM)")

    @field_validator("sensor_id")
    @classmethod
    def sensor_id_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("sensor_id ne peut pas être vide")
        return value


class ForecastPoint(BaseModel):
    timestamp: datetime
    predicted_power_kw: float
    confidence_interval: Optional[dict] = None


class ForecastResponse(BaseModel):
    sensor_id: str
    forecast_start: datetime
    horizon_minutes: int
    forecast_series: List[ForecastPoint]
    model_version: str
