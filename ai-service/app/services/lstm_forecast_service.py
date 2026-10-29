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
        Prédit la consommation future avec LSTM en générant une série temporelle.
        
        Args:
            features: Features pour la prédiction (array numpy 2D: [n_samples, n_features])
            horizon_minutes: Horizon de prévision en minutes
            sensor_id: Identifiant du capteur pour charger le bon modèle
        
        Returns:
            Dictionnaire avec la série de prédictions et intervalles de confiance
        """
        if not self.is_loaded or (sensor_id and sensor_id != self.current_sensor_id):
            self.load_model(sensor_id)
        
        # S'assurer que features est 2D
        if features.ndim == 1:
            features = features.reshape(-1, 1)
        
        print(f"Features shape: {features.shape}, Sequence length: {self.sequence_length}")
        
        # Vérifier qu'on a assez de données
        if features.shape[0] < self.sequence_length:
            raise ValueError(f"Données insuffisantes: besoin de {self.sequence_length} échantillons, reçu {features.shape[0]}")
        
        # Normaliser les features
        print(f"Scaler n_features_in_: {self.scaler.n_features_in_}")
        print(f"Features shape before transform: {features.shape}")
        features_scaled = self.scaler.transform(features)
        
        # Générer des prévisions par heure sur l'horizon demandé
        forecast_hours = max(1, horizon_minutes // 60)
        forecast_series = []
        current_sequence = features_scaled[-self.sequence_length:].copy()
        
        for hour in range(forecast_hours):
            # Créer séquence pour LSTM
            sequence = current_sequence.reshape(1, self.sequence_length, -1)
            
            # Prédiction
            prediction = self.model.predict(sequence, verbose=0)[0][0]
            
            # Denormaliser
            dummy_features = np.zeros((1, self.scaler.n_features_in_))
            dummy_features[0, 0] = prediction
            prediction_denorm = self.scaler.inverse_transform(dummy_features)[0, 0]
            
            # Estimation de l'incertitude (augmente avec le temps)
            expected_error = prediction_denorm * (0.05 + 0.01 * hour)  # 5% + 1% par heure
            
            confidence_interval = {
                "lower": float(prediction_denorm - expected_error),
                "upper": float(prediction_denorm + expected_error),
                "std_dev": float(expected_error / 1.96)
            }
            
            forecast_series.append({
                "timestamp": datetime.utcnow() + timedelta(hours=hour + 1),
                "predicted_power_kw": float(prediction_denorm),
                "confidence_interval": confidence_interval
            })
            
            # Mettre à jour la séquence pour la prochaine prédiction (sliding window)
            # On remplace la valeur la plus ancienne par la prédiction normalisée
            new_row = current_sequence[-1].copy()
            new_row[0] = prediction  # power_kw
            current_sequence = np.roll(current_sequence, -1, axis=0)
            current_sequence[-1] = new_row
        
        return {
            "forecast_series": forecast_series,
            "horizon_minutes": horizon_minutes
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
