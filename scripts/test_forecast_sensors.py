#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8085"

sensors = ["SENSOR-001", "SENSOR-002", "SENSOR-003"]

print("=== Test RandomForest Forecast ===")
for sensor_id in sensors:
    print(f"\n--- Test RandomForest pour {sensor_id} ---")
    payload = {
        "sensor_id": sensor_id,
        "horizon_minutes": 60
    }
    response = requests.post(f"{BASE_URL}/api/v1/forecasts/predict", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Forecast: {json.dumps(data, indent=2)}")
    else:
        print(f"Error: {response.text}")

print("\n\n=== Test LSTM Forecast ===")
for sensor_id in sensors:
    print(f"\n--- Test LSTM pour {sensor_id} ---")
    payload = {
        "sensor_id": sensor_id,
        "horizon_minutes": 60
    }
    response = requests.post(f"{BASE_URL}/api/v1/lstm-forecasts/predict", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Forecast: {json.dumps(data, indent=2)}")
    else:
        print(f"Error: {response.text}")

print("\n\n=== Test LSTM Forecast 7 jours ===")
for sensor_id in sensors:
    print(f"\n--- Test LSTM 7 jours pour {sensor_id} ---")
    payload = {
        "sensor_id": sensor_id,
        "horizon_minutes": 10080  # 7 jours
    }
    response = requests.post(f"{BASE_URL}/api/v1/lstm-forecasts/predict", json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Forecast: {json.dumps(data, indent=2)}")
    else:
        print(f"Error: {response.text}")
