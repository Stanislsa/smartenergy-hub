#!/usr/bin/env python3
import json
import requests
import sys

# Charger les données
with open('/tmp/sensor001_1d.json', 'r') as f:
    data = json.load(f)

measurements = data['SENSOR-001']
print(f'Chargement de {len(measurements)} mesures pour SENSOR-001')

# Envoyer au collector
collector_url = 'http://localhost:8081/api/measurements'
success = 0
for i, m in enumerate(measurements):
    try:
        resp = requests.post(collector_url, json=m, timeout=5)
        if resp.status_code == 200:
            success += 1
        if (i + 1) % 10 == 0:
            print(f'{i+1}/{len(measurements)} envoyés, {success} succès')
    except Exception as e:
        print(f'Erreur à {i}: {e}')

print(f'Total: {success}/{len(measurements)} envoyés avec succès')
