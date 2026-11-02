from fastapi import APIRouter
from app.core.config import get_settings
from datetime import datetime
from typing import Optional
import os
import json

router = APIRouter()


@router.get("/status")
async def get_model_status():
    """
    Retourne l'état du modèle actif.
    """
    settings = get_settings()
    scaler_path = settings.anomaly_model_path.replace("model_", "scaler_")
    model_exists = os.path.exists(settings.anomaly_model_path) and os.path.exists(scaler_path)
    metadata_path = os.path.join(os.path.dirname(settings.anomaly_model_path), "metadata.json")
    metadata = {}
    if model_exists and os.path.exists(metadata_path):
        try:
            with open(metadata_path, encoding="utf-8") as metadata_file:
                metadata = json.load(metadata_file)
        except (OSError, json.JSONDecodeError):
            metadata = {}
    
    return {
        "model_name": "AnomalyDetector",
        "version": "rules-v1" if not model_exists else metadata.get("version", "ml-v1"),
        "status": "loaded" if model_exists else "rules_only",
        "model_type": "Isolation Forest" if model_exists else "Business Rules",
        "last_trained": metadata.get("trained_at"),
        "metrics": metadata.get("metrics", {}),
        "features": ["power_kw", "voltage", "temperature"],
        "thresholds": {
            "power_threshold_kw": settings.power_threshold_kw,
            "voltage_min": settings.voltage_min,
            "voltage_max": settings.voltage_max,
            "temperature_max": settings.temperature_max
        }
    }
