from fastapi import APIRouter, HTTPException
from app.schemas.prediction import ForecastRequest, ForecastResponse
from app.services.forecast_service import ForecastService
import numpy as np

router = APIRouter()
forecast_service = ForecastService()


@router.post("/predict", response_model=ForecastResponse)
async def predict_forecast(request: ForecastRequest):
    """
    Prédit la consommation future avec Random Forest (prévisions court terme).
    
    Utilise le modèle Random Forest entraîné pour prédire la puissance
    sur l'horizon spécifié avec intervalle de confiance.
    Convient pour les prévisions à court terme (heures/jours).
    """
    try:
        # Récupérer les features depuis Cassandra
        features = forecast_service.get_features_from_cassandra(request.sensor_id)
        
        # Prédire avec le modèle spécifique au capteur
        prediction = forecast_service.predict(features, request.horizon_minutes, sensor_id=request.sensor_id)
        
        return ForecastResponse(
            sensor_id=request.sensor_id,
            forecast_time=prediction["forecast_time"],
            horizon_minutes=request.horizon_minutes,
            predicted_power_kw=prediction["predicted_power_kw"],
            confidence_interval=prediction["confidence_interval"],
            model_version="forecast-v1"
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail="Modèle de prévision non disponible - entraînement requis")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
