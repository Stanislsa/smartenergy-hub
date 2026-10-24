"""
Script d'entraînement du modèle de détection d'anomalies.
Utilise Isolation Forest pour détecter les anomalies non-supervisées.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import os
from datetime import datetime


class AnomalyModelTrainer:
    def __init__(self, data_path: str = "data/raw/dataset.csv"):
        self.data_path = data_path
        self.model: IsolationForest = None
        self.scaler: StandardScaler = None
        self.features = ['power_kw', 'voltage', 'temperature']
    
    def load_data(self) -> pd.DataFrame:
        """Charge le dataset d'entraînement"""
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Dataset non trouvé: {self.data_path}")
        
        df = pd.read_csv(self.data_path)
        print(f"Dataset chargé: {len(df)} lignes")
        return df
    
    def preprocess_data(self, df: pd.DataFrame) -> tuple:
        """
        Prépare les données pour l'entraînement.
        
        Returns:
            X_train, X_test, scaler
        """
        # Sélectionner les features
        X = df[self.features].copy()
        
        # Imputer les valeurs manquantes avec la médiane
        for col in self.features:
            if X[col].isna().any():
                median = X[col].median()
                X[col] = X[col].fillna(median)
        
        # Normalisation
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # Séparation train/test (chronologique)
        X_train, X_test = train_test_split(
            X_scaled, test_size=0.2, shuffle=False
        )
        
        print(f"Train: {len(X_train)} samples, Test: {len(X_test)} samples")
        return X_train, X_test
    
    def train_model(self, X_train: np.ndarray, contamination: float = 0.1):
        """
        Entraîne le modèle Isolation Forest.
        
        Args:
            X_train: Données d'entraînement
            contamination: Proportion attendue d'anomalies
        """
        self.model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        
        self.model.fit(X_train)
        print("Modèle entraîné avec succès")
    
    def save_model(self, output_dir: str = "artifacts/anomaly_detector"):
        """Sauvegarde le modèle et le scaler"""
        os.makedirs(output_dir, exist_ok=True)
        
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Sauvegarder le modèle avec version
        model_path = os.path.join(output_dir, f"model_v{version}.joblib")
        joblib.dump(self.model, model_path)
        
        # Sauvegarder le scaler avec version
        scaler_path = os.path.join(output_dir, f"scaler_v{version}.joblib")
        joblib.dump(self.scaler, scaler_path)
        
        # Sauvegarder sous v1 pour le service
        model_v1_path = os.path.join(output_dir, "model_v1.joblib")
        scaler_v1_path = os.path.join(output_dir, "scaler_v1.joblib")
        joblib.dump(self.model, model_v1_path)
        joblib.dump(self.scaler, scaler_v1_path)
        
        # Sauvegarder les métadonnées
        metadata = {
            "version": version,
            "model_type": "IsolationForest",
            "features": self.features,
            "contamination": 0.1,
            "trained_at": datetime.now().isoformat()
        }
        
        metadata_path = os.path.join(output_dir, "metadata.json")
        import json
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Modèle sauvegardé: {model_path}")
        print(f"Scaler sauvegardé: {scaler_path}")
        print(f"Modèle v1 sauvegardé: {model_v1_path}")
        print(f"Scaler v1 sauvegardé: {scaler_v1_path}")
        print(f"Métadonnées sauvegardées: {metadata_path}")


if __name__ == "__main__":
    print("=== Entraînement du modèle d'anomalie ===")
    trainer = AnomalyModelTrainer("data/raw/dataset.csv")
    df = trainer.load_data()
    X_train, X_test = trainer.preprocess_data(df)
    trainer.train_model(X_train)
    trainer.save_model()
