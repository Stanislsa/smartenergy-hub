"""
Script d'entraînement du modèle de prévision de consommation.
Utilise Random Forest Regressor pour prédire la puissance future.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os
import json
from datetime import datetime
from app.preprocessing.features import to_hourly


class ForecastModelTrainer:
    def __init__(self, data_path: str = "data/raw/forecast_dataset.csv"):
        self.data_path = data_path
        self.model: RandomForestRegressor = None
        self.scaler: StandardScaler = None
        self.features = [
            'power_kw_lag_1', 'power_kw_lag_2', 'power_kw_lag_3',
            'power_kw_lag_6', 'power_kw_lag_12', 'power_kw_lag_24',
            'hour', 'day_of_week', 'is_weekend', 'month',
            'voltage', 'temperature'
        ]
    
    def load_data(self) -> pd.DataFrame:
        """Charge le dataset d'entraînement"""
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Dataset non trouvé: {self.data_path}")
        
        df = pd.read_csv(self.data_path)
        df['measured_at'] = pd.to_datetime(df['measured_at'], utc=True)
        print(f"Dataset chargé: {len(df)} lignes")
        
        # Regrouper par heure avant de créer les lags
        measurements = df.to_dict('records')
        df_hourly = to_hourly(measurements)
        print(f"Données horaires: {len(df_hourly)} lignes")
        
        return df_hourly.reset_index()
    
    def create_lag_features(self, df: pd.DataFrame, sensor_id: str = None) -> pd.DataFrame:
        """
        Crée des features de lag pour la prévision.
        
        Args:
            df: DataFrame avec les mesures
            sensor_id: Filtrer par capteur (optionnel)
        
        Returns:
            DataFrame avec features de lag
        """
        if sensor_id:
            df = df[df['sensor_id'] == sensor_id].copy()
        
        df = df.sort_values('measured_at')
        
        # Créer lags
        for lag in [1, 2, 3, 6, 12, 24]:
            df[f'power_kw_lag_{lag}'] = df['power_kw'].shift(lag)
        
        # Créer features temporelles
        df['hour'] = df['measured_at'].dt.hour
        df['day_of_week'] = df['measured_at'].dt.dayofweek
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        df['month'] = df['measured_at'].dt.month
        
        # Supprimer les NaN créés par les lags
        df = df.dropna()
        
        print(f"Features créées: {len(df)} lignes après création de lags")
        return df
    
    def preprocess_data(self, df: pd.DataFrame) -> tuple:
        """
        Prépare les données pour l'entraînement.
        
        Returns:
            X_train, X_test, y_train, y_test, scaler
        """
        # Sélectionner les features
        available_features = [f for f in self.features if f in df.columns]
        X = df[available_features].copy()
        y = df['power_kw'].copy()
        
        # Imputer les valeurs manquantes avec la médiane
        for col in X.columns:
            if X[col].isna().any():
                median = X[col].median()
                X[col] = X[col].fillna(median)
        
        # Normalisation
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # Séparation train/test (chronologique)
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, shuffle=False
        )
        
        print(f"Train: {len(X_train)} samples, Test: {len(X_test)} samples")
        return X_train, X_test, y_train, y_test
    
    def train_model(self, X_train: np.ndarray, y_train: np.ndarray):
        """
        Entraîne le modèle Random Forest.
        
        Args:
            X_train: Données d'entraînement
            y_train: Labels d'entraînement
        """
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        
        self.model.fit(X_train, y_train)
        print("Modèle entraîné avec succès")
    
    def evaluate_model(self, X_test: np.ndarray, y_test: np.ndarray) -> dict:
        """
        Évalue le modèle sur les données de test.
        
        Args:
            X_test: Données de test
            y_test: Labels de test
        
        Returns:
            Dictionnaire avec les métriques
        """
        y_pred = self.model.predict(X_test)
        
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)
        mape = np.mean(np.abs((y_test - y_pred) / y_test)) * 100
        
        print(f"\n=== Résultats d'évaluation ===")
        print(f"MAE: {mae:.4f} kW")
        print(f"RMSE: {rmse:.4f} kW")
        print(f"R²: {r2:.4f}")
        print(f"MAPE: {mape:.2f}%")
        
        return {
            "mae": float(mae),
            "rmse": float(rmse),
            "r2": float(r2),
            "mape": float(mape)
        }
    
    def save_model(self, output_dir: str = "artifacts/forecast_model"):
        """Sauvegarde le modèle et le scaler"""
        os.makedirs(output_dir, exist_ok=True)
        
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Sauvegarder le modèle
        model_path = os.path.join(output_dir, f"forecast_model_v{version}.joblib")
        joblib.dump(self.model, model_path)
        
        # Sauvegarder le scaler
        scaler_path = os.path.join(output_dir, f"forecast_scaler_v{version}.joblib")
        joblib.dump(self.scaler, scaler_path)
        
        # Sauvegarder les métadonnées
        metadata = {
            "version": version,
            "model_type": "RandomForestRegressor",
            "features": self.features,
            "n_estimators": 100,
            "max_depth": 10,
            "trained_at": datetime.now().isoformat()
        }
        
        metadata_path = os.path.join(output_dir, "forecast_metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Modèle sauvegardé: {model_path}")
        print(f"Scaler sauvegardé: {scaler_path}")
        print(f"Métadonnées sauvegardées: {metadata_path}")


if __name__ == "__main__":
    print("=== Entraînement du modèle de prévision ===")
    
    # NOTE: Ce script ne peut pas être exécuté tant que le dataset n'est pas disponible
    print("ATTENTION: Le dataset doit d'abord être généré via build_dataset.py")
    print("Le dataset doit contenir un historique suffisant (1000+ mesures par capteur)")
    
    # Exemple d'utilisation (commenté):
    # trainer = ForecastModelTrainer("data/raw/forecast_dataset.csv")
    # df = trainer.load_data()
    # df = trainer.create_lag_features(df)
    # X_train, X_test, y_train, y_test = trainer.preprocess_data(df)
    # trainer.train_model(X_train, y_train)
    # metrics = trainer.evaluate_model(X_test, y_test)
    # trainer.save_model()
