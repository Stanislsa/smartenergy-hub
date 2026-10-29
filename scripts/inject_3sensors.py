#!/usr/bin/env python3
import json
import requests
import sys

# Charger les données pour les 3 capteurs
sensors = {
    'SENSOR-001': '/tmp/sensor001_8d_5m.json',
    'SENSOR-002': '/tmp/sensor002_8d_5m.json',
    'SENSOR-003': '/tmp/sensor003_8d_5m.json'
}

collector_url = 'http://localhost:8081/api/measurements'
total_success = 0

for sensor_id, file_path in sensors.items():
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    measurements = data[sensor_id]
    print(f'Chargement de {len(measurements)} mesures pour {sensor_id}')
    
    success = 0
    for i, m in enumerate(measurements):
        try:
            resp = requests.post(collector_url, json=m, timeout=10)
            if resp.status_code in [200, 202]:
                success += 1
            if (i + 1) % 10 == 0:
                print(f'{i+1}/{len(measurements)} envoyés, {success} succès')
        except Exception as e:
            print(f'Erreur à {i}: {e}')
    
    print(f'{sensor_id}: {success}/{len(measurements)} envoyés avec succès')
    total_success += success

print(f'Total: {total_success} mesures envoyées avec succès')
