from app.core.config import get_settings
from app.services.cassandra_service import CassandraService
from app.preprocessing.features import to_hourly
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import joblib
import numpy as np
import os
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ForecastService:
    def __init__(self):
        self.settings = get_settings()
        self.model: Optional[RandomForestRegressor] = None
        self.scaler: Optional[StandardScaler] = None
        self.is_loaded = False
        self.current_sensor_id: Optional[str] = None
        self.cassandra = CassandraService()
    
    def load_model(self, sensor_id: str = None):
        """Charge le modèle et le scaler depuis les fichiers."""
        sensor_suffix = f"_{sensor_id}" if sensor_id else ""
        model_path = f"artifacts/forecast_model/forecast_model_v1{sensor_suffix}.joblib"
        scaler_path = f"artifacts/forecast_model/forecast_scaler_v1{sensor_suffix}.joblib"
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Modèle non trouvé: {model_path}")
        
        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path)
        self.is_loaded = True
        self.current_sensor_id = sensor_id
        logger.info(f"Modèle chargé: {model_path}")
    
    def get_features_from_cassandra(self, sensor_id: str, hours: int = 24) -> np.ndarray:
        """
        Récupère les features depuis Cassandra pour la prévision.
        
        Args:
            sensor_id: Identifiant du capteur
            hours: Nombre d'heures d'historique
        
        Returns:
            Features pour la prévision
        
        Raises:
            ValueError: Si données insuffisantes
        """
        measurements = self.cassandra.get_latest_measurements(sensor_id, hours)
        
        if not measurements or len(measurements) < 24:
            raise ValueError(f"Données insuffisantes pour {sensor_id} ({len(measurements)} h)")
        
        # Regrouper par heure avant de créer les lags
        df_hourly = to_hourly(measurements)
        
        if len(df_hourly) < 24:
            raise ValueError(f"Données horaires insuffisantes pour {sensor_id} ({len(df_hourly)} h)")
        
        # Calculer les lags sur les données horaires
        power_values = df_hourly['power_kw'].tolist()
        voltage = df_hourly['voltage'].iloc[-1] if 'voltage' in df_hourly.columns else 230.0
        temperature = df_hourly['temperature'].iloc[-1] if 'temperature' in df_hourly.columns else 35.0
        
        # Features temporelles
        latest_timestamp = df_hourly.index[-1]
        hour = latest_timestamp.hour
        day_of_week = latest_timestamp.weekday()
        is_weekend = 1 if day_of_week >= 5 else 0
        month = latest_timestamp.month
        
        # Lags
        lags = []
        for lag in [1, 2, 3, 6, 12, 24]:
            if lag < len(power_values):
                lags.append(power_values[-lag])
            else:
                lags.append(power_values[0])
        
        features = np.array([[
            lags[0], lags[1], lags[2], lags[3], lags[4], lags[5],
            hour, day_of_week, is_weekend, month,
            voltage, temperature
        ]])
        
        return features
    
    def predict(self, features: np.ndarray, horizon_minutes: int = 60, sensor_id: str = None) -> Dict:
        """
        Prédit la consommation future.
        
        Args:
            features: Features pour la prédiction
            horizon_minutes: Horizon de prévision en minutes
            sensor_id: Identifiant du capteur pour charger le bon modèle
        
        Returns:
            Dictionnaire avec la prédiction et l'intervalle de confiance
        """
        if not self.is_loaded or (sensor_id and sensor_id != self.current_sensor_id):
            self.load_model(sensor_id)
        
        features_scaled = self.scaler.transform(features)
        prediction = self.model.predict(features_scaled)[0]
        
        # Calculer l'intervalle de confiance depuis les arbres
        predictions = [tree.predict(features_scaled) for tree in self.model.estimators_]
        std_dev = np.std(predictions)
        
        confidence_interval = {
            "lower": float(prediction - 1.96 * std_dev),
            "upper": float(prediction + 1.96 * std_dev),
            "std_dev": float(std_dev)
        }
        
        expected_error = std_dev * 1.96
        
        return {
            "predicted_power_kw": float(prediction),
            "confidence_interval": confidence_interval,
            "expected_error_kw": float(expected_error),
            "horizon_minutes": horizon_minutes,
            "forecast_time": datetime.utcnow() + timedelta(minutes=horizon_minutes)
        }
    
    def predict_batch(self, features_list: List[np.ndarray], horizon_minutes: int = 60) -> List[Dict]:
        """Prédit plusieurs horizons."""
        predictions = []
        for features in features_list:
            pred = self.predict(features, horizon_minutes)
            predictions.append(pred)
        return predictions
    
    def get_model_info(self) -> Dict:
        """Retourne les informations du modèle."""
        if not self.is_loaded:
            return {"status": "not_loaded", "message": "Modèle non chargé"}
        
        return {
            "status": "loaded",
            "model_type": "RandomForestRegressor",
            "model_path": self.model_path,
            "loaded_at": datetime.utcnow().isoformat()
        }
