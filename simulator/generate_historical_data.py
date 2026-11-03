#!/usr/bin/env python3
"""
Génère des données historiques pour les capteurs existants
"""

import random
from datetime import datetime, timedelta
import requests
import time

SENSORS = ["SENSOR-001", "SENSOR-002", "SENSOR-003"]
COLLECTOR_URL = "http://localhost:8081/api/measurements"

def generate_measurement(sensor_id, timestamp):
    """Génère une mesure pour un capteur"""
    return {
        "sensorId": sensor_id,
        "timestamp": timestamp.isoformat() + "Z",
        "powerKw": round(random.uniform(1.0, 8.0), 2),
        "voltage": round(random.uniform(220, 240), 1),
        "current": round(random.uniform(2.0, 15.0), 2),
        "frequency": round(random.uniform(49.9, 50.1), 2),
        "temperature": round(random.uniform(20.0, 30.0), 1)
    }

def generate_historical_data(hours=168):
    """Génère des données historiques pour les derniers X heures"""
    print(f"Génération de données historiques pour {hours} heures...")
    
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)
    
    current_time = start_time
    measurements_sent = 0
    errors = 0
    
    while current_time < end_time:
        for sensor_id in SENSORS:
            measurement = generate_measurement(sensor_id, current_time)
            try:
                response = requests.post(COLLECTOR_URL, json=measurement, timeout=10)
                if response.status_code in [200, 201, 202]:
                    measurements_sent += 1
                    if measurements_sent % 100 == 0:
                        print(f"{measurements_sent} mesures envoyées...")
                else:
                    errors += 1
                    if errors < 5:
                        print(f"Erreur HTTP {response.status_code}: {response.text}")
            except Exception as e:
                errors += 1
                if errors < 5:
                    print(f"Erreur envoi: {e}")
        
        current_time += timedelta(minutes=5)  # Une mesure toutes les 5 minutes
        time.sleep(0.05)  # Délai pour ne pas surcharger
    
    print(f"Terminé! {measurements_sent} mesures envoyées, {errors} erreurs.")

if __name__ == "__main__":
    generate_historical_data(hours=288)  # 12 jours de données (marge pour 168h requis)
