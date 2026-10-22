from fastapi import APIRouter
from app.core.config import get_settings
from datetime import datetime
from typing import Optional
import os

router = APIRouter()


@router.get("/status")
async def get_model_status():
    """
    Retourne l'état du modèle actif.
    """
    settings = get_settings()
    model_exists = os.path.exists(settings.anomaly_model_path)
    
    return {
        "model_name": "AnomalyDetector",
        "version": "rules-v1" if not model_exists else "ml-v1",
        "status": "loaded" if model_exists else "rules_only",
        "model_type": "Isolation Forest" if model_exists else "Business Rules",
        "last_trained": None,  # À implémenter avec les métadonnées du modèle
        "features": ["power_kw", "voltage", "temperature"],
        "thresholds": {
            "power_threshold_kw": settings.power_threshold_kw,
            "voltage_min": settings.voltage_min,
            "voltage_max": settings.voltage_max,
            "temperature_max": settings.temperature_max
        }
    }
