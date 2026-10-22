from sklearn.ensemble import IsolationForest
import numpy as np
from typing import Optional

class AnomalyDetector:
    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.is_trained = False
    
    def train(self, X: np.ndarray):
        self.model = IsolationForest(contamination=0.1, random_state=42)
        self.model.fit(X)
        self.is_trained = True
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_trained:
            return np.zeros(len(X))
        return self.model.score_samples(X)
