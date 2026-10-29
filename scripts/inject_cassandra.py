#!/usr/bin/env python3
"""
Injecte directement des données dans Cassandra pour les tests de prévision.
"""
import json
import uuid
from datetime import datetime
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider

# Configuration
CASSANDRA_HOST = 'localhost'
CASSANDRA_PORT = 9042
KEYSPACE = 'smartenergy'

# Charger les données depuis synthetic_data.json
with open('synthetic_data.json', 'r') as f:
    all_data = json.load(f)

# Connexion à Cassandra
cluster = Cluster([CASSANDRA_HOST], port=CASSANDRA_PORT)
session = cluster.connect()
session.set_keyspace(KEYSPACE)

# Préparer la requête d'insertion
prepared = session.prepare("""
    INSERT INTO measurements_by_sensor_day 
    (sensor_id, day, record_id, measured_at, power_kw, voltage, temperature)
    VALUES (?, ?, ?, ?, ?, ?, ?)
""")

total_inserted = 0

for sensor_id in all_data.keys():
    measurements = all_data[sensor_id]
    print(f'Chargement de {len(measurements)} mesures pour {sensor_id}')
    
    inserted = 0
    for m in measurements:
        try:
            day = m['timestamp'][:10]  # YYYY-MM-DD
            record_id = uuid.uuid4()
            measured_at = datetime.fromisoformat(m['timestamp'].replace('Z', '+00:00'))
            
            session.execute(prepared, [
                sensor_id,
                day,
                record_id,
                measured_at,
                m['powerKw'],
                m['voltage'],
                m['temperature']
            ])
            inserted += 1
            if inserted % 10 == 0:
                print(f'{inserted}/{len(measurements)} insérés')
        except Exception as e:
            print(f'Erreur: {e}')
    
    print(f'{sensor_id}: {inserted}/{len(measurements)} insérés')
    total_inserted += inserted

print(f'Total: {total_inserted} mesures insérées')

cluster.shutdown()
