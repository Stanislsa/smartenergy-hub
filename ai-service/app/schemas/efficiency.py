from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class EfficiencyResponse(BaseModel):
    sensor_id: str
    analysis_period: str  # e.g., "7d", "30d", "90d"
    efficiency_score: float = Field(..., ge=0, le=100, description="Score d'efficacité (0-100)")
    average_consumption_kw: float
    expected_consumption_kw: float
    deviation_percent: float
    overconsumption_periods: List[dict]
    underconsumption_periods: List[dict]
    recommendations: List[str]
    analyzed_at: datetime


class EfficiencyComparison(BaseModel):
    """Comparaison avec la période précédente"""
    current_period_score: float
    previous_period_score: float
    score_change: float
    consumption_change_percent: float
    trend: str  # "improving", "stable", "degrading"
