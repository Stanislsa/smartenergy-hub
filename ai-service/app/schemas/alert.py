from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class AlertSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertRequest(BaseModel):
    sensor_id: str = Field(..., description="Identifiant du capteur")
    timestamp: datetime = Field(..., description="Horodatage UTC de la mesure")
    power_kw: float = Field(..., gt=0, description="Puissance en kW")
    voltage: Optional[float] = Field(None, ge=0, description="Tension en V")
    temperature: Optional[float] = Field(None, description="Température en °C")


class AlertResponse(BaseModel):
    alert_id: str
    sensor_id: str
    timestamp: datetime
    severity: AlertSeverity
    alert_type: str
    observed_value: float
    expected_value: Optional[float] = None
    threshold: Optional[float] = None
    deviation_percent: Optional[float] = None
    explanation: str
    recommendations: List[str]
    created_at: datetime
    model_version: str


class AlertHistoryResponse(BaseModel):
    sensor_id: str
    total_alerts: int
    alerts: List[AlertResponse]


class ActiveAlertsResponse(BaseModel):
    total_active: int
    alerts: List[AlertResponse]
