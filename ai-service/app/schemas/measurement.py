from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class MeasurementRequest(BaseModel):
    sensor_id: str = Field(..., description="Identifiant du capteur")
    timestamp: datetime = Field(..., description="Horodatage UTC de la mesure")
    power_kw: float = Field(..., gt=0, description="Puissance en kW")
    voltage: Optional[float] = Field(None, ge=0, description="Tension en V")
    temperature: Optional[float] = Field(None, description="Température en °C")


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
