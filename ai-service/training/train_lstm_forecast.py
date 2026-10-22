"""
Script d'entraînement du modèle LSTM pour prévisions à long terme.
Utilise LSTM pour prédire la puissance future (semaines/mois).
"""

import pandas as pd
import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os
import json
from datetime import datetime


class LSTMForecastTrainer:
    def __init__(self, data_path: str = "data/raw/forecast_dataset.csv"):
        self.data_path = data_path
        self.model: Sequential = None
        self.scaler: MinMaxScaler = None
        self.sequence_length = 168  # 7 jours de contexte (168 heures)
        self.features = ['power_kw', 'voltage', 'temperature', 'hour', 'day_of_week', 'is_weekend', 'month']
    
    def load_data(self) -> pd.DataFrame:
        """Charge le dataset d'entraînement"""
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Dataset non trouvé: {self.data_path}")
        
        df = pd.read_csv(self.data_path)
        df['measured_at'] = pd.to_datetime(df['measured_at'])
        print(f"Dataset chargé: {len(df)} lignes")
        return df
    
    def create_temporal_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Crée des features temporelles pour LSTM"""
        df = df.sort_values('measured_at')
        
        df['hour'] = df['measured_at'].dt.hour
        df['day_of_week'] = df['measured_at'].dt.dayofweek
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        df['month'] = df['measured_at'].dt.month
        
        for col in ['voltage', 'temperature']:
            if col in df.columns:
                df[col] = df[col].fillna(df[col].median())
        
        print(f"Features créées: {len(df)} lignes")
        return df
    
    def create_sequences(self, data: np.ndarray) -> tuple:
        """Crée des séquences pour LSTM"""
        X, y = [], []
        for i in range(len(data) - self.sequence_length):
            X.append(data[i:i + self.sequence_length])
            y.append(data[i + self.sequence_length, 0])
        
        return np.array(X), np.array(y)
    
    def preprocess_data(self, df: pd.DataFrame) -> tuple:
        """Prépare les données pour LSTM"""
        available_features = [f for f in self.features if f in df.columns]
        data = df[available_features].copy()
        
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        data_scaled = self.scaler.fit_transform(data)
        
        X, y = self.create_sequences(data_scaled)
        
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        print(f"Train: {len(X_train)} sequences, Test: {len(X_test)} sequences")
        print(f"Sequence shape: {X_train.shape}")
        return X_train, X_test, y_train, y_test
    
    def train_model(self, X_train: np.ndarray, y_train: np.ndarray):
        """Entraîne le modèle LSTM"""
        n_features = X_train.shape[2]
        
        self.model = Sequential([
            LSTM(64, return_sequences=True, input_shape=(self.sequence_length, n_features)),
            Dropout(0.2),
            LSTM(64, return_sequences=False),
            Dropout(0.2),
            Dense(32),
            Dense(1)
        ])
        
        self.model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        
        early_stopping = EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True)
        
        history = self.model.fit(
            X_train, y_train,
            epochs=100,
            batch_size=32,
            validation_split=0.2,
            callbacks=[early_stopping],
            verbose=1
        )
        
        print("Modèle LSTM entraîné avec succès")
        return history
    
    def evaluate_model(self, X_test: np.ndarray, y_test: np.ndarray) -> dict:
        """Évalue le modèle LSTM"""
        y_pred = self.model.predict(X_test, verbose=0)
        
        y_pred_denorm = self.scaler.inverse_transform(
            np.concatenate([y_pred.reshape(-1, 1), np.zeros((len(y_pred), self.scaler.n_features_in_ - 1))], axis=1)
        )[:, 0]
        
        y_test_denorm = self.scaler.inverse_transform(
            np.concatenate([y_test.reshape(-1, 1), np.zeros((len(y_test), self.scaler.n_features_in_ - 1))], axis=1)
        )[:, 0]
        
        mae = mean_absolute_error(y_test_denorm, y_pred_denorm)
        rmse = np.sqrt(mean_squared_error(y_test_denorm, y_pred_denorm))
        r2 = r2_score(y_test_denorm, y_pred_denorm)
        mape = np.mean(np.abs((y_test_denorm - y_pred_denorm) / y_test_denorm)) * 100
        
        print(f"\n=== Résultats d'évaluation LSTM ===")
        print(f"MAE: {mae:.4f} kW")
        print(f"RMSE: {rmse:.4f} kW")
        print(f"R²: {r2:.4f}")
        print(f"MAPE: {mape:.2f}%")
        
        return {"mae": float(mae), "rmse": float(rmse), "r2": float(r2), "mape": float(mape)}
    
    def save_model(self, output_dir: str = "artifacts/lstm_forecast_model"):
        """Sauvegarde le modèle LSTM et le scaler"""
        os.makedirs(output_dir, exist_ok=True)
        
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        model_path = os.path.join(output_dir, f"lstm_model_v{version}.keras")
        self.model.save(model_path)
        
        scaler_path = os.path.join(output_dir, f"lstm_scaler_v{version}.joblib")
        joblib.dump(self.scaler, scaler_path)
        
        metadata = {
            "version": version,
            "model_type": "LSTM",
            "features": self.features,
            "sequence_length": self.sequence_length,
            "trained_at": datetime.now().isoformat()
        }
        
        metadata_path = os.path.join(output_dir, "lstm_metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Modèle LSTM sauvegardé: {model_path}")
        print(f"Scaler sauvegardé: {scaler_path}")
        print(f"Métadonnées sauvegardées: {metadata_path}")


if __name__ == "__main__":
    print("=== Entraînement du modèle LSTM pour prévisions long terme ===")
    print("ATTENTION: Le dataset doit contenir un historique suffisant (10000+ mesures pour LSTM)")
