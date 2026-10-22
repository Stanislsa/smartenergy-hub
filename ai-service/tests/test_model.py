import pytest
import numpy as np
from app.models.anomaly_detector import AnomalyDetector


def test_anomaly_detector_initialization():
    """Test de l'initialisation du détecteur"""
    detector = AnomalyDetector()
    assert detector.model is None
    assert detector.is_trained == False


def test_anomaly_detector_train():
    """Test de l'entraînement du modèle"""
    detector = AnomalyDetector()
    X = np.random.randn(100, 3)  # 100 échantillons, 3 features
    
    detector.train(X)
    
    assert detector.model is not None
    assert detector.is_trained == True


def test_anomaly_detector_predict_untrained():
    """Test de prédiction sans entraînement"""
    detector = AnomalyDetector()
    X = np.random.randn(10, 3)
    
    scores = detector.predict(X)
    
    assert len(scores) == 10
    assert all(score == 0 for score in scores)


def test_anomaly_detector_predict_trained():
    """Test de prédiction après entraînement"""
    detector = AnomalyDetector()
    X_train = np.random.randn(100, 3)
    X_test = np.random.randn(10, 3)
    
    detector.train(X_train)
    scores = detector.predict(X_test)
    
    assert len(scores) == 10
    # Les scores ne devraient pas tous être zéro après entraînement
    assert not all(score == 0 for score in scores)
