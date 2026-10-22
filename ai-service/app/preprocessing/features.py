import pandas as pd
import numpy as np
from datetime import datetime


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
