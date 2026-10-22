"""
Script d'évaluation du modèle de détection d'anomalies.
"""

import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import json
from typing import Optional
import os


class ModelEvaluator:
    def __init__(self, model_path: str, scaler_path: str):
        self.model_path = model_path
        self.scaler_path = scaler_path
        self.model = None
        self.scaler = None
    
    def load_model(self):
        """Charge le modèle et le scaler"""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Modèle non trouvé: {self.model_path}")
        
        self.model = joblib.load(self.model_path)
        self.scaler = joblib.load(self.scaler_path)
        print(f"Modèle chargé: {self.model_path}")
    
    def evaluate(self, X_test: np.ndarray, y_test: Optional[np.ndarray] = None):
        """
        Évalue le modèle sur les données de test.
        
        Args:
            X_test: Données de test
            y_test: Labels de vérité terrain (optionnel, pour supervisé)
        """
        # Prédictions
        predictions = self.model.predict(X_test)
        scores = self.model.score_samples(X_test)
        
        # Isolation Forest: -1 = anomalie, 1 = normal
        anomaly_count = (predictions == -1).sum()
        normal_count = (predictions == 1).sum()
        
        print(f"\n=== Résultats d'évaluation ===")
        print(f"Total samples: {len(X_test)}")
        print(f"Anomalies détectées: {anomaly_count} ({anomaly_count/len(X_test)*100:.1f}%)")
        print(f"Normaux: {normal_count} ({normal_count/len(X_test)*100:.1f}%)")
        print(f"Score moyen: {scores.mean():.4f}")
        print(f"Score min: {scores.min():.4f}")
        print(f"Score max: {scores.max():.4f}")
        
        # Si labels disponibles (supervisé)
        if y_test is not None:
            # Convertir -1/1 en 0/1 pour sklearn
            y_pred = (predictions == -1).astype(int)
            print("\n=== Rapport de classification ===")
            print(classification_report(y_test, y_pred))
            print("\n=== Matrice de confusion ===")
            print(confusion_matrix(y_test, y_pred))
        
        return {
            "total_samples": len(X_test),
            "anomalies": int(anomaly_count),
            "normals": int(normal_count),
            "anomaly_rate": float(anomaly_count / len(X_test)),
            "mean_score": float(scores.mean())
        }
    
    def save_report(self, report: dict, output_path: str = "artifacts/anomaly_detector/evaluation_report.json"):
        """Sauvegarde le rapport d'évaluation"""
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"Rapport sauvegardé: {output_path}")


if __name__ == "__main__":
    print("=== Évaluation du modèle d'anomalie ===")
    
    # NOTE: Ce script ne peut pas être exécuté tant que le modèle n'est pas entraîné
    print("ATTENTION: Le modèle doit d'abord être entraîné via train_anomaly_model.py")
    
    # Exemple d'utilisation (commenté):
    # evaluator = ModelEvaluator(
    #     model_path="artifacts/anomaly_detector/model_v20261022_120000.joblib",
    #     scaler_path="artifacts/anomaly_detector/scaler_v20261022_120000.joblib"
    # )
    # evaluator.load_model()
    # report = evaluator.evaluate(X_test)
    # evaluator.save_report(report)
