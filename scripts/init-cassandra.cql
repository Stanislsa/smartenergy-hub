-- Initialisation du Keyspace et des Tables Cassandra pour Smart Energy Hub

-- Créer le keyspace s'il n'existe pas
CREATE KEYSPACE IF NOT EXISTS smartenergy
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
AND durable_writes = true;

-- Utiliser le keyspace
USE smartenergy;

-- Créer la table des lectures énergétiques (données de séries temporelles)
CREATE TABLE IF NOT EXISTS energy_readings (
    device_id text,
    timestamp timestamp,
    power_kw decimal,
    voltage decimal,
    current decimal,
    frequency decimal,
    PRIMARY KEY ((device_id), timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC)
AND compaction = {'class': 'TimeWindowCompactionStrategy'}
AND gc_grace_seconds = 864000;

-- Créer la table des métadonnées des appareils
CREATE TABLE IF NOT EXISTS devices (
    device_id text PRIMARY KEY,
    device_name text,
    device_type text,
    location text,
    created_at timestamp,
    last_seen timestamp
);

-- Créer la table d'agrégation quotidienne
CREATE TABLE IF NOT EXISTS daily_energy_summary (
    device_id text,
    date text,
    total_energy_kwh decimal,
    avg_power_kw decimal,
    max_power_kw decimal,
    min_power_kw decimal,
    reading_count int,
    PRIMARY KEY ((device_id), date)
) WITH CLUSTERING ORDER BY (date DESC);

-- Créer un index sur le type d'appareil pour les requêtes
CREATE INDEX IF NOT EXISTS idx_device_type ON devices (device_type);

-- Insérer des données d'appareils d'exemple
INSERT INTO devices (device_id, device_name, device_type, location, created_at, last_seen)
VALUES ('device_1', 'Smart Meter 1', 'meter', 'Building A', toTimestamp(now()), toTimestamp(now()));

INSERT INTO devices (device_id, device_name, device_type, location, created_at, last_seen)
VALUES ('device_2', 'Smart Meter 2', 'meter', 'Building B', toTimestamp(now()), toTimestamp(now()));

INSERT INTO devices (device_id, device_name, device_type, location, created_at, last_seen)
VALUES ('device_3', 'Solar Panel Inverter', 'inverter', 'Rooftop', toTimestamp(now()), toTimestamp(now()));
