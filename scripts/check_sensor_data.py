#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/adriano/projets/smartenergy-hub/ai-service')

from app.services.cassandra_service import CassandraService
from app.preprocessing.features import to_hourly

cassandra = CassandraService()

sensors = ["SENSOR-001", "SENSOR-002", "SENSOR-003"]

for sensor_id in sensors:
    print(f"\n=== {sensor_id} ===")
    measurements = cassandra.get_latest_measurements(sensor_id, 168)
    print(f"Mesures brutes: {len(measurements)}")
    
    df = to_hourly(measurements)
    print(f"Données horaires: {len(df)}")
    
    if len(df) > 0:
        print(f"Première heure: {df.index[0]}")
        print(f"Dernière heure: {df.index[-1]}")
