from fastapi import APIRouter, HTTPException
from app.schemas.prediction import ForecastRequest, ForecastResponse
from app.services.lstm_forecast_service import LSTMForecastService
import numpy as np
from datetime import datetime

router = APIRouter()
lstm_service = LSTMForecastService()


@router.post("/predict", response_model=ForecastResponse)
async def predict_lstm_forecast(request: ForecastRequest):
    """
    Prédit la consommation future avec LSTM (prévisions long terme).
    
    Utilise le modèle LSTM entraîné pour prédire la puissance
    sur l'horizon spécifié avec intervalle de confiance.
    Convient pour les prévisions à long terme (semaines/mois).
    """
    try:
        if not lstm_service.is_loaded:
            lstm_service.load_model()
        
        # Pour l'instant, utiliser des features factices
        # TODO: Récupérer les vraies features depuis l'historique du capteur
        features = np.array([[5.0, 230.0, 35.0, 14, 2, 0, 10]] * 168)
        
        prediction = lstm_service.predict(features, request.horizon_minutes)
        
        return ForecastResponse(
            sensor_id=request.sensor_id,
            forecast_time=prediction["forecast_time"],
            horizon_minutes=request.horizon_minutes,
            predicted_power_kw=prediction["predicted_power_kw"],
            confidence_interval=prediction["confidence_interval"],
            model_version="lstm-v1"
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail="Modèle LSTM non disponible - entraînement requis"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info")
async def get_lstm_model_info():
    """Retourne les informations du modèle LSTM."""
    return lstm_service.get_model_info()
