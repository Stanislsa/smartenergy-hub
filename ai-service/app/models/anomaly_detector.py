from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import numpy as np
import joblib
import os
from typing import Optional

class AnomalyDetector:
    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None
        self.is_trained = False
        self.model_path = "artifacts/anomaly_detector/model_v1.joblib"
        self.scaler_path = "artifacts/anomaly_detector/scaler_v1.joblib"
    
    def load_model(self):
        """Charge le modèle et le scaler depuis les fichiers."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modèle non trouvé: {self.model_path}")
        
        self.model = joblib.load(self.model_path)
        self.scaler = joblib.load(self.scaler_path)
        self.is_trained = True
        print(f"Modèle d'anomalies chargé: {self.model_path}")
    
    def train(self, X: np.ndarray):
        self.model = IsolationForest(contamination=0.1, random_state=42)
        self.model.fit(X)
        self.is_trained = True
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_trained:
            try:
                self.load_model()
            except FileNotFoundError:
                return np.zeros(len(X))
        
        X_scaled = self.scaler.transform(X)
        return self.model.score_samples(X_scaled)
