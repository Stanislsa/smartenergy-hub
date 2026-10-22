import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict


def to_hourly(measurements: List[Dict]) -> pd.DataFrame:
    """
    Regroupe les mesures par heure avec interpolation.
    
    Les lags (1, 2, 3, 6, 12, 24) supposent une mesure par heure,
    mais les données sont toutes les 5 minutes. Cette fonction
    regroupe par heure avant de créer les lags.
    
    Args:
        measurements: Liste de mesures avec measured_at, power_kw, voltage, temperature
    
    Returns:
        DataFrame avec index horaire et colonnes power_kw, voltage, temperature
    """
    df = pd.DataFrame(measurements)
    df["measured_at"] = pd.to_datetime(df["measured_at"], utc=True)
    return (df.set_index("measured_at")[["power_kw", "voltage", "temperature"]]
              .resample("1h").mean()
              .interpolate(limit=2)
              .dropna())


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
