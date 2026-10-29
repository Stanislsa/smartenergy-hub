import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict


def to_hourly(measurements: List[Dict], sensor_id: str = None) -> pd.DataFrame:
    """
    Regroupe les mesures par heure avec interpolation.
    
    Les lags (1, 2, 3, 6, 12, 24) supposent une mesure par heure,
    mais les données sont toutes les 5 minutes. Cette fonction
    regroupe par heure avant de créer les lags.
    
    Args:
        measurements: Liste de mesures avec measured_at, power_kw, voltage, temperature, sensor_id
        sensor_id: Filtrer par capteur (optionnel)
    
    Returns:
        DataFrame avec index horaire et colonnes power_kw, voltage, temperature, sensor_id
    """
    df = pd.DataFrame(measurements)
    df["measured_at"] = pd.to_datetime(df["measured_at"], utc=True)
    
    # Filtrer par sensor_id si spécifié
    if sensor_id and "sensor_id" in df.columns:
        df = df[df["sensor_id"] == sensor_id].copy()
    
    # Si plusieurs capteurs, agréger par capteur
    if "sensor_id" in df.columns and df["sensor_id"].nunique() > 1:
        results = []
        for sid in df["sensor_id"].unique():
            df_sensor = df[df["sensor_id"] == sid].copy()
            df_sensor = df_sensor.drop(columns=["sensor_id"])
            result_sensor = (df_sensor.set_index("measured_at")[["power_kw", "voltage", "temperature"]]
                           .resample("1h").mean()
                           .interpolate(limit=2)
                           .dropna())
            result_sensor["sensor_id"] = sid
            results.append(result_sensor)
        result = pd.concat(results)
        return result
    
    # Cas simple: un seul capteur ou pas de sensor_id
    sensor_id_col = None
    if "sensor_id" in df.columns:
        sensor_id_col = df["sensor_id"].iloc[0] if len(df) > 0 else None
        df = df.drop(columns=["sensor_id"])
    
    # Agréger les colonnes numériques
    result = (df.set_index("measured_at")[["power_kw", "voltage", "temperature"]]
              .resample("1h").mean()
              .interpolate(limit=2)
              .dropna())
    
    # Réajouter sensor_id si présent
    if sensor_id_col is not None:
        result["sensor_id"] = sensor_id_col
    
    return result


class FeatureExtractor:
    """Extraction de caractéristiques temporelles et statistiques"""
    
    @staticmethod
    def extract_temporal_features(timestamp: datetime) -> dict:
        """Extrait les caractéristiques temporelles"""
        return {
            "hour": timestamp.hour,
            "day_of_week": timestamp.weekday(),
            "is_weekend": timestamp.weekday() >= 5,
            "month": timestamp.month
        }
    
    @staticmethod
    def extract_statistical_features(series: pd.Series, window: int = 10) -> dict:
        """Extrait les caractéristiques statistiques glissantes"""
        if len(series) < window:
            return {}
        
        return {
            "mean": series.rolling(window).mean().iloc[-1],
            "std": series.rolling(window).std().iloc[-1],
            "min": series.rolling(window).min().iloc[-1],
            "max": series.rolling(window).max().iloc[-1]
        }
