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
        self.model_path = "artifacts/forecast_model/forecast_model_v1.joblib"
        self.scaler_path = "artifacts/forecast_model/forecast_scaler_v1.joblib"
        self.cassandra = CassandraService()
    
    def load_model(self):
        """Charge le modèle et le scaler depuis les fichiers."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modèle non trouvé: {self.model_path}")
        
        self.model = joblib.load(self.model_path)
        self.scaler = joblib.load(self.scaler_path)
        self.is_loaded = True
        logger.info(f"Modèle chargé: {self.model_path}")
    
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
    
    def predict(self, features: np.ndarray, horizon_minutes: int = 60) -> Dict:
        """
        Prédit la consommation future.
        
        Args:
            features: Features pour la prédiction
            horizon_minutes: Horizon de prévision en minutes
        
        Returns:
            Dictionnaire avec la prédiction et l'intervalle de confiance
        """
        if not self.is_loaded:
            self.load_model()
        
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
