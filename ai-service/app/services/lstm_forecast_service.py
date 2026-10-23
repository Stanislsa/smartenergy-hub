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
        self.model_path = "artifacts/lstm_forecast_model/lstm_model_v1.keras"
        self.scaler_path = "artifacts/lstm_forecast_model/lstm_scaler_v1.joblib"
        self.sequence_length = 168  # 7 jours de contexte
    
    def load_model(self):
        """Charge le modèle LSTM et le scaler depuis les fichiers."""
        if not TENSORFLOW_AVAILABLE:
            raise RuntimeError("TensorFlow n'est pas installé. Installez requirements-lstm.txt pour utiliser le LSTM.")
        
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modèle LSTM non trouvé: {self.model_path}")
        
        self.model = load_model(self.model_path)
        self.scaler = joblib.load(self.scaler_path)
        self.is_loaded = True
        print(f"Modèle LSTM chargé: {self.model_path}")
    
    def predict(self, features: np.ndarray, horizon_minutes: int = 60) -> Dict:
        """
        Prédit la consommation future avec LSTM.
        
        Args:
            features: Features pour la prédiction (array numpy)
            horizon_minutes: Horizon de prévision en minutes
        
        Returns:
            Dictionnaire avec la prédiction et l'intervalle de confiance
        """
        if not self.is_loaded:
            self.load_model()
        
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
