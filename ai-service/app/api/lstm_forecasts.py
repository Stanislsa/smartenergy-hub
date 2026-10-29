from fastapi import APIRouter, HTTPException
from app.schemas.prediction import ForecastRequest, ForecastResponse
from app.services.lstm_forecast_service import LSTMForecastService
from app.services.cassandra_service import CassandraService
from app.preprocessing.features import to_hourly
import numpy as np
from datetime import datetime, timedelta

router = APIRouter()
lstm_service = LSTMForecastService()
cassandra = CassandraService()


@router.post("/predict", response_model=ForecastResponse)
async def predict_lstm_forecast(request: ForecastRequest):
    """
    Prédit la consommation future avec LSTM (prévisions long terme).
    
    Utilise le modèle LSTM entraîné pour prédire la puissance
    sur l'horizon spécifié avec intervalle de confiance.
    Convient pour les prévisions à long terme (semaines/mois).
    
    Nécessite 168 heures (7 jours) d'historique.
    """
    try:
        # Récupérer les 168 dernières heures depuis Cassandra
        hours_needed = 168
        measurements = cassandra.get_latest_measurements(request.sensor_id, hours_needed)
        
        if not measurements or len(measurements) < hours_needed:
            raise HTTPException(
                status_code=422,
                detail=f"Données insuffisantes pour LSTM: besoin de {hours_needed}h, reçu {len(measurements)}h"
            )
        
        # Regrouper par heure
        df_hourly = to_hourly(measurements)
        
        if len(df_hourly) < hours_needed:
            raise HTTPException(
                status_code=422,
                detail=f"Données horaires insuffisantes: besoin de {hours_needed}h, reçu {len(df_hourly)}h"
            )
        
        # Créer les features temporelles
        df_hourly['hour'] = df_hourly.index.hour
        df_hourly['day_of_week'] = df_hourly.index.dayofweek
        df_hourly['is_weekend'] = (df_hourly['day_of_week'] >= 5).astype(int)
        df_hourly['month'] = df_hourly.index.month
        
        # Sélectionner les 168 dernières heures
        feature_cols = ['power_kw', 'voltage', 'temperature', 'hour', 'day_of_week', 'is_weekend', 'month']
        available_cols = [c for c in feature_cols if c in df_hourly.columns]
        
        # Remplir les valeurs manquantes pour voltage et temperature
        for col in ['voltage', 'temperature']:
            if col in df_hourly.columns:
                df_hourly[col] = df_hourly[col].fillna(df_hourly[col].median())
        
        features_array = df_hourly[available_cols].tail(hours_needed).values
        
        print(f"Features array shape: {features_array.shape}, Columns: {available_cols}")
        print(f"Features array ndim: {features_array.ndim}")
        print(f"Features array sample: {features_array[:2] if len(features_array) > 1 else features_array}")
        
        # Prédire avec le modèle spécifique au capteur
        prediction = lstm_service.predict(features_array, request.horizon_minutes, sensor_id=request.sensor_id)
        
        return ForecastResponse(
            sensor_id=request.sensor_id,
            forecast_start=datetime.utcnow(),
            horizon_minutes=request.horizon_minutes,
            forecast_series=prediction["forecast_series"],
            model_version="lstm-v1"
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail="Modèle LSTM non disponible - entraînement requis"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info")
async def get_lstm_model_info():
    """Retourne les informations du modèle LSTM."""
    return lstm_service.get_model_info()
