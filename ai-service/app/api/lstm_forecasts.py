from fastapi import APIRouter, HTTPException, Query
from app.schemas.prediction import ForecastRequest, ForecastResponse
from app.services.lstm_forecast_service import LSTMForecastService
from app.services.cassandra_service import CassandraService
from app.preprocessing.features import to_hourly
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

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
        
        if df_hourly.empty:
            raise HTTPException(
                status_code=422,
                detail="Aucune donnée horaire exploitable pour le LSTM"
            )

        # Construire une séquence régulière : 168 observations espacées d'une heure.
        latest_hour = df_hourly.index.max().floor("h")
        expected_hours = pd.date_range(end=latest_hour, periods=hours_needed, freq="h", tz="UTC")
        df_hourly = df_hourly.reindex(expected_hours).interpolate(method="time", limit=2)
        if df_hourly["power_kw"].isna().any():
            raise HTTPException(
                status_code=422,
                detail="Historique LSTM incomplet: il manque plus de deux heures consécutives"
            )
        
        # Créer les features temporelles
        df_hourly['hour'] = df_hourly.index.hour
        df_hourly['day_of_week'] = df_hourly.index.dayofweek
        df_hourly['is_weekend'] = (df_hourly['day_of_week'] >= 5).astype(int)
        df_hourly['month'] = df_hourly.index.month
        
        # Sélectionner les 168 dernières heures
        feature_cols = ['power_kw', 'voltage', 'temperature', 'hour', 'day_of_week', 'is_weekend', 'month']
        # Le scaler est entraîné sur ces sept colonnes dans cet ordre.
        # Les capteurs peuvent omettre les champs facultatifs voltage/température.
        for col in ['voltage', 'temperature']:
            if col not in df_hourly.columns:
                df_hourly[col] = 230.0 if col == 'voltage' else 35.0
            median = df_hourly[col].median()
            fallback = 230.0 if col == 'voltage' else 35.0
            df_hourly[col] = df_hourly[col].fillna(median if np.isfinite(median) else fallback)
        
        features_array = df_hourly[feature_cols].tail(hours_needed).values
        
        if features_array.shape != (hours_needed, len(feature_cols)):
            raise HTTPException(status_code=422, detail="Séquence de caractéristiques LSTM invalide")
        
        # Prédire avec le modèle spécifique au capteur
        prediction = lstm_service.predict(features_array, request.horizon_minutes, sensor_id=request.sensor_id)
        
        return ForecastResponse(
            sensor_id=request.sensor_id,
            forecast_start=datetime.now(timezone.utc),
            horizon_minutes=request.horizon_minutes,
            forecast_series=prediction["forecast_series"],
            model_version=lstm_service.get_model_info().get("version", "lstm-v1")
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail="Modèle LSTM non disponible - entraînement requis"
        )
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur interne pendant la prévision LSTM")


@router.get("/info")
async def get_lstm_model_info(sensor_id: str | None = Query(default=None, min_length=1)):
    """Retourne les informations du modèle LSTM."""
    try:
        return lstm_service.get_model_info(sensor_id.strip() if sensor_id else None)
    except FileNotFoundError:
        return {"status": "not_available", "model_type": "LSTM"}
    except RuntimeError as error:
        return {"status": "not_available", "model_type": "LSTM", "message": str(error)}
