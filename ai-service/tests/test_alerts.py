import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from app.main import app


client = TestClient(app)


def test_create_alert_normal():
    """Test création alerte avec mesure normale"""
    payload = {
        "sensor_id": "SENSOR-001",
        "timestamp": "2026-10-22T08:00:00Z",
        "power_kw": 3.5,
        "voltage": 230.0,
        "temperature": 35.0
    }
    response = client.post("/api/v1/alerts/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sensor_id"] == "SENSOR-001"
    assert "alert_id" in data
    assert "severity" in data
    assert "explanation" in data
    assert "recommendations" in data


def test_create_alert_high_power():
    """Test création alerte avec puissance excessive"""
    payload = {
        "sensor_id": "SENSOR-002",
        "timestamp": "2026-10-22T14:00:00Z",
        "power_kw": 15.0,
        "voltage": 230.0,
        "temperature": 35.0
    }
    response = client.post("/api/v1/alerts/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["severity"] == "CRITICAL"
    assert "ALERTE CRITIQUE" in data["recommendations"][0]


def test_create_alert_voltage_out_of_range():
    """Test création alerte avec tension hors plage"""
    payload = {
        "sensor_id": "SENSOR-003",
        "timestamp": "2026-10-22T10:00:00Z",
        "power_kw": 5.0,
        "voltage": 200.0
    }
    response = client.post("/api/v1/alerts/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["alert_type"] == "VOLTAGE_OUT_OF_RANGE"


def test_create_alert_high_temperature():
    """Test création alerte avec température excessive"""
    payload = {
        "sensor_id": "SENSOR-004",
        "timestamp": "2026-10-22T16:00:00Z",
        "power_kw": 5.0,
        "temperature": 90.0
    }
    response = client.post("/api/v1/alerts/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["alert_type"] == "HIGH_TEMPERATURE"


def test_get_alert_history():
    """Test récupération historique alertes"""
    # D'abord créer une alerte
    payload = {
        "sensor_id": "SENSOR-005",
        "timestamp": "2026-10-22T09:00:00Z",
        "power_kw": 5.0,
        "voltage": 230.0
    }
    client.post("/api/v1/alerts/", json=payload)
    
    # Récupérer l'historique
    response = client.get("/api/v1/alerts/SENSOR-005")
    assert response.status_code == 200
    data = response.json()
    assert data["sensor_id"] == "SENSOR-005"
    assert "total_alerts" in data
    assert "alerts" in data


def test_get_active_alerts():
    """Test récupération alertes actives"""
    response = client.get("/api/v1/alerts/active")
    assert response.status_code == 200
    data = response.json()
    assert "total_active" in data
    assert "alerts" in data


def test_create_alert_invalid_power():
    """Test création alerte avec puissance invalide"""
    payload = {
        "sensor_id": "SENSOR-006",
        "timestamp": "2026-10-22T11:00:00Z",
        "power_kw": -1.0
    }
    response = client.post("/api/v1/alerts/", json=payload)
    assert response.status_code == 422
