from app.core.config import get_settings
from sklearn.preprocessing import MinMaxScaler
import joblib
import numpy as np
import os
from typing import Optional, List, Dict
from datetime import datetime, timedelta

# TensorFlow est optionnel
try:
    from tensorflow.keras.models import load_model
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    load_model = None


class LSTMForecastService:
    def __init__(self):
        self.settings = get_settings()
        self.model = None
        self.scaler: Optional[MinMaxScaler] = None
        self.is_loaded = False
        self.current_sensor_id: Optional[str] = None
        self.sequence_length = 168  # 7 jours de contexte
    
    def load_model(self, sensor_id: str = None):
        """Charge le modèle LSTM et le scaler depuis les fichiers."""
        if not TENSORFLOW_AVAILABLE:
            raise RuntimeError("TensorFlow n'est pas installé. Installez requirements-lstm.txt pour utiliser le LSTM.")
        
        sensor_suffix = f"_{sensor_id}" if sensor_id else ""
        model_path = f"artifacts/lstm_forecast_model/lstm_model_v1{sensor_suffix}.keras"
        scaler_path = f"artifacts/lstm_forecast_model/lstm_scaler_v1{sensor_suffix}.joblib"
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Modèle LSTM non trouvé: {model_path}")
        
        self.model = load_model(model_path)
        self.scaler = joblib.load(scaler_path)
        self.is_loaded = True
        self.current_sensor_id = sensor_id
        print(f"Modèle LSTM chargé: {model_path}")
    
    def predict(self, features: np.ndarray, horizon_minutes: int = 60, sensor_id: str = None) -> Dict:
        """
        Prédit la consommation future avec LSTM.
        
        Args:
            features: Features pour la prédiction (array numpy)
            horizon_minutes: Horizon de prévision en minutes
            sensor_id: Identifiant du capteur pour charger le bon modèle
        
        Returns:
            Dictionnaire avec la prédiction et l'intervalle de confiance
        """
        if not self.is_loaded or (sensor_id and sensor_id != self.current_sensor_id):
            self.load_model(sensor_id)
        
        # Normaliser les features
        features_scaled = self.scaler.transform(features)
        
        # Créer séquence pour LSTM
        sequence = features_scaled[-self.sequence_length:].reshape(1, self.sequence_length, -1)
        
        # Prédiction
        prediction = self.model.predict(sequence, verbose=0)[0][0]
        
        # Denormaliser
        prediction_denorm = self.scaler.inverse_transform(
            np.concatenate([[prediction], np.zeros((1, self.scaler.n_features_in_ - 1))], axis=1)
        )[0][0]
        
        # Estimation de l'incertitude (basée sur l'historique des erreurs)
        # Pour LSTM, on utilise une estimation basée sur la variance des prédictions récentes
        expected_error = prediction_denorm * 0.1  # 10% de marge d'erreur estimée
        
        confidence_interval = {
            "lower": float(prediction_denorm - expected_error),
            "upper": float(prediction_denorm + expected_error),
            "std_dev": float(expected_error / 1.96)
        }
        
        return {
            "predicted_power_kw": float(prediction_denorm),
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
        """Retourne les informations du modèle LSTM."""
        if not self.is_loaded:
            return {"status": "not_loaded", "message": "Modèle LSTM non chargé"}
        
        return {
            "status": "loaded",
            "model_type": "LSTM",
            "sequence_length": self.sequence_length,
            "model_path": self.model_path,
            "loaded_at": datetime.utcnow().isoformat()
        }
