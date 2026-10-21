-- Initialisation du Keyspace et des Tables Cassandra pour Smart Energy Hub
-- Conception selon le cahier des charges avec partition (sensor_id, day)

-- Créer le keyspace s'il n'existe pas
CREATE KEYSPACE IF NOT EXISTS smartenergy
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
AND durable_writes = true;

-- Utiliser le keyspace
USE smartenergy;

-- Table principale : Mesures par capteur
-- Partition : (sensor_id, day)
-- Clustering : measured_at DESC
CREATE TABLE IF NOT EXISTS measurements_by_sensor_day (
    sensor_id text,
    day date,
    measured_at timestamp,
    power_kw double,
    voltage double,
    current double,
    frequency double,
    temperature double,
    record_id uuid,
    PRIMARY KEY ((sensor_id, day), measured_at)
) WITH CLUSTERING ORDER BY (measured_at DESC)
AND compaction = {'class': 'TimeWindowCompactionStrategy'}
AND gc_grace_seconds = 864000;

-- Table des anomalies détectées (optionnelle pour MVP)
CREATE TABLE IF NOT EXISTS anomalies_by_sensor (
    sensor_id text,
    detected_at timestamp,
    anomaly_type text,
    power_kw double,
    threshold double,
    severity text,
    description text,
    PRIMARY KEY ((sensor_id), detected_at)
) WITH CLUSTERING ORDER BY (detected_at DESC);

-- Table des métadonnées des capteurs (sera migrée vers MongoDB selon le CDC)
-- Conservée temporairement pour compatibilité
CREATE TABLE IF NOT EXISTS devices (
    device_id text PRIMARY KEY,
    device_name text,
    device_type text,
    location text,
    created_at timestamp,
    last_seen timestamp
);

-- Créer un index sur le type d'appareil pour les requêtes
CREATE INDEX IF NOT EXISTS idx_device_type ON devices (device_type);

-- Insérer des données d'appareils d'exemple
INSERT INTO devices (device_id, device_name, device_type, location, created_at, last_seen)
VALUES ('SENSOR-001', 'Compteur salle serveur', 'meter', 'Bâtiment A', toTimestamp(now()), toTimestamp(now()));

INSERT INTO devices (device_id, device_name, device_type, location, created_at, last_seen)
VALUES ('SENSOR-002', 'Compteur hall entree', 'meter', 'Bâtiment B', toTimestamp(now()), toTimestamp(now()));

INSERT INTO devices (device_id, device_name, device_type, location, created_at, last_seen)
VALUES ('SENSOR-003', 'Onduleur panneau solaire', 'inverter', 'Toiture', toTimestamp(now()), toTimestamp(now()));
