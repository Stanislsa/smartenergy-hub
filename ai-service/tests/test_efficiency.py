import pytest
from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_get_efficiency_default_period():
    """Test analyse efficacité avec période par défaut (30 jours)"""
    response = client.get("/api/v1/efficiency/SENSOR-001")
    assert response.status_code == 200
    data = response.json()
    assert data["sensor_id"] == "SENSOR-001"
    assert "efficiency_score" in data
    assert 0 <= data["efficiency_score"] <= 100
    assert "average_consumption_kw" in data
    assert "deviation_percent" in data
    assert "recommendations" in data


def test_get_efficiency_custom_period():
    """Test analyse efficacité avec période personnalisée"""
    response = client.get("/api/v1/efficiency/SENSOR-002?period_days=7")
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_period"] == "7d"


def test_get_efficiency_invalid_period():
    """Test analyse efficacité avec période invalide (>365)"""
    response = client.get("/api/v1/efficiency/SENSOR-003?period_days=400")
    assert response.status_code == 422


def test_get_efficiency_zero_period():
    """Test analyse efficacité avec période zéro"""
    response = client.get("/api/v1/efficiency/SENSOR-004?period_days=0")
    assert response.status_code == 422


def test_get_efficiency_structure():
    """Test structure de la réponse efficacité"""
    response = client.get("/api/v1/efficiency/SENSOR-005")
    assert response.status_code == 200
    data = response.json()
    
    required_fields = [
        "sensor_id", "analysis_period", "efficiency_score",
        "average_consumption_kw", "expected_consumption_kw",
        "deviation_percent", "overconsumption_periods",
        "underconsumption_periods", "recommendations", "analyzed_at"
    ]
    
    for field in required_fields:
        assert field in data, f"Field {field} missing from response"
