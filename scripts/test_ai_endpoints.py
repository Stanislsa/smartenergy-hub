#!/usr/bin/env python3
"""
Script de test des endpoints IA pour Smart Energy Hub.
Valide les contrats JSON et les réponses des modèles.
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8085"

def test_health():
    """Test du endpoint health"""
    print("\n=== Test /health ===")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_anomaly_detector():
    """Test du endpoint anomalies/predict"""
    print("\n=== Test /api/v1/anomalies/predict ===")
    
    # Test avec données normales
    payload = {
        "sensor_id": "SENSOR-001",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "power_kw": 5.5,
        "voltage": 230,
        "temperature": 25
    }
    response = requests.post(f"{BASE_URL}/api/v1/anomalies/predict", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    assert response.status_code == 200
    data = response.json()
    assert "is_anomaly" in data
    assert "severity" in data
    assert "anomaly_score" in data
    
    # Test avec données anormales (puissance excessive)
    payload_anomaly = {
        "sensor_id": "SENSOR-001",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "power_kw": 50.0,  # Très élevé
        "voltage": 230,
        "temperature": 25
    }
    response = requests.post(f"{BASE_URL}/api/v1/anomalies/predict", json=payload_anomaly)
    print(f"\nTest anomalie (puissance élevée):")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    assert response.status_code == 200

def test_forecast_rf():
    """Test du endpoint forecasts/predict (Random Forest)"""
    print("\n=== Test /api/v1/forecasts/predict (Random Forest) ===")
    
    payload = {
        "sensor_id": "SENSOR-001",
        "horizon_minutes": 60
    }
    response = requests.post(f"{BASE_URL}/api/v1/forecasts/predict", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    assert response.status_code == 200
    data = response.json()
    assert "forecast_series" in data
    assert len(data["forecast_series"]) > 0
    assert "predicted_power_kw" in data["forecast_series"][0]
    assert "timestamp" in data["forecast_series"][0]

def test_forecast_lstm():
    """Test du endpoint lstm-forecasts/predict (LSTM)"""
    print("\n=== Test /api/v1/lstm-forecasts/predict (LSTM) ===")
    
    payload = {
        "sensor_id": "SENSOR-001",
        "horizon_minutes": 60
    }
    response = requests.post(f"{BASE_URL}/api/v1/lstm-forecasts/predict", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        data = response.json()
        assert "forecast_series" in data
        assert len(data["forecast_series"]) > 0
        assert "predicted_power_kw" in data["forecast_series"][0]
        assert "timestamp" in data["forecast_series"][0]
        assert "confidence_interval" in data["forecast_series"][0]
    else:
        print(f"Error: {response.text}")

def test_model_status():
    """Test du endpoint model/status"""
    print("\n=== Test /api/v1/model/status ===")
    response = requests.get(f"{BASE_URL}/api/v1/model/status")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

if __name__ == "__main__":
    print("=== Début des tests des endpoints IA ===")
    print(f"Base URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now()}")
    
    try:
        test_health()
        test_anomaly_detector()
        test_forecast_rf()
        test_forecast_lstm()
        test_model_status()
        
        print("\n=== Tous les tests passés avec succès ===")
    except AssertionError as e:
        print(f"\n=== Test échoué: {e} ===")
    except requests.exceptions.ConnectionError:
        print("\n=== Erreur de connexion: ai-service non disponible ===")
    except Exception as e:
        print(f"\n=== Erreur inattendue: {e} ===")
