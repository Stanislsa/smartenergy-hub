from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional


class MeasurementRequest(BaseModel):
    sensor_id: str = Field(..., min_length=1, description="Identifiant du capteur")
    timestamp: datetime = Field(..., description="Horodatage UTC de la mesure")
    power_kw: float = Field(..., ge=0, description="Puissance en kW")
    voltage: Optional[float] = Field(None, ge=0, description="Tension en V")
    temperature: Optional[float] = Field(None, description="Température en °C")

    @field_validator("sensor_id")
    @classmethod
    def sensor_id_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("sensor_id ne peut pas être vide")
        return value

    @field_validator("timestamp")
    @classmethod
    def timestamp_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp doit inclure un fuseau horaire")
        return value


class AnomalyResponse(BaseModel):
    sensor_id: str
    timestamp: datetime
    is_anomaly: bool
    anomaly_score: float
    severity: str
    reasons: list[str]
    model_version: str


class ModelStatusResponse(BaseModel):
    model_name: str
    version: str
    status: str
    last_trained: Optional[datetime]
