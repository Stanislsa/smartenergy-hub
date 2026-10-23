import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_forecast_model_not_loaded():
    """Test prévision sans modèle entraîné"""
    payload = {
        "sensor_id": "SENSOR-001",
        "horizon_minutes": 60
    }
    response = client.post("/api/v1/forecasts/predict", json=payload)
    # Devrait retourner 503 car le modèle n'existe pas
    assert response.status_code == 503
    data = response.json()
    assert "detail" in data
    assert "non disponible" in data["detail"]


def test_forecast_invalid_horizon():
    """Test prévision avec horizon invalide"""
    payload = {
        "sensor_id": "SENSOR-002",
        "horizon_minutes": 2000  # > 1440
    }
    response = client.post("/api/v1/forecasts/predict", json=payload)
    assert response.status_code == 422  # Validation error


def test_forecast_zero_horizon():
    """Test prévision avec horizon zéro"""
    payload = {
        "sensor_id": "SENSOR-003",
        "horizon_minutes": 0  # < 1
    }
    response = client.post("/api/v1/forecasts/predict", json=payload)
    assert response.status_code == 422


def test_forecast_valid_horizon():
    """Test prévision avec horizon valide"""
    payload = {
        "sensor_id": "SENSOR-004",
        "horizon_minutes": 60
    }
    response = client.post("/api/v1/forecasts/predict", json=payload)
    # 503 car modèle non disponible, mais validation OK
    assert response.status_code == 503


def test_forecast_missing_sensor_id():
    """Test prévision sans sensor_id"""
    payload = {
        "horizon_minutes": 60
    }
    response = client.post("/api/v1/forecasts/predict", json=payload)
    assert response.status_code == 422
