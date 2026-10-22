import pytest
from datetime import datetime
from app.preprocessing.features import FeatureExtractor


def test_extract_temporal_features():
    """Test de l'extraction de caractéristiques temporelles"""
    timestamp = datetime(2026, 10, 22, 14, 30, 0)
    features = FeatureExtractor.extract_temporal_features(timestamp)
    
    assert features["hour"] == 14
    assert features["day_of_week"] == 2  # Mercredi
    assert features["is_weekend"] == False
    assert features["month"] == 10


def test_extract_temporal_features_weekend():
    """Test de l'extraction pour un week-end"""
    timestamp = datetime(2026, 10, 25, 10, 0, 0)  # Samedi
    features = FeatureExtractor.extract_temporal_features(timestamp)
    
    assert features["is_weekend"] == True


def test_extract_statistical_features():
    """Test de l'extraction de caractéristiques statistiques"""
    import pandas as pd
    series = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0])
    features = FeatureExtractor.extract_statistical_features(series, window=5)
    
    assert "mean" in features
    assert "std" in features
    assert "min" in features
    assert "max" in features
    assert features["mean"] == 8.0  # Moyenne des 5 derniers


def test_extract_statistical_features_insufficient_data():
    """Test avec données insuffisantes"""
    import pandas as pd
    series = pd.Series([1.0, 2.0])
    features = FeatureExtractor.extract_statistical_features(series, window=10)
    
    assert features == {}
