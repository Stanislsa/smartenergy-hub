import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from app.main import app


client = TestClient(app)


def test_predict_anomaly_normal():
    """Test de prédiction avec mesure normale"""
    payload = {
        "sensor_id": "SENSOR-001",
        "timestamp": "2026-10-22T08:00:00Z",
        "power_kw": 3.5,
        "voltage": 230.0,
        "temperature": 35.0
    }
    response = client.post("/api/v1/anomalies/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sensor_id"] == "SENSOR-001"
    assert "is_anomaly" in data
    assert "anomaly_score" in data
    assert "severity" in data


def test_predict_anomaly_high_power():
    """Test de prédiction avec puissance excessive"""
    payload = {
        "sensor_id": "SENSOR-002",
        "timestamp": "2026-10-22T14:00:00Z",
        "power_kw": 15.0,
        "voltage": 230.0,
        "temperature": 35.0
    }
    response = client.post("/api/v1/anomalies/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_anomaly"] == True
    assert data["severity"] == "HIGH"


def test_predict_anomaly_invalid_power():
    """Test de prédiction avec puissance invalide (négative)"""
    payload = {
        "sensor_id": "SENSOR-003",
        "timestamp": "2026-10-22T10:00:00Z",
        "power_kw": -1.0
    }
    response = client.post("/api/v1/anomalies/predict", json=payload)
    assert response.status_code == 422  # Validation error


def test_predict_anomaly_missing_required_field():
    """Test de prédiction sans champ requis"""
    payload = {
        "sensor_id": "SENSOR-004",
        "timestamp": "2026-10-22T10:00:00Z"
        # power_kw manquant
    }
    response = client.post("/api/v1/anomalies/predict", json=payload)
    assert response.status_code == 422
