-- Supprimer les données de test incohérentes de Cassandra
-- Ces capteurs (TEST-SENSOR-001, SENSOR-TEST-002) n'existent pas dans MongoDB

DELETE FROM smartenergy.measurements_by_sensor_day WHERE sensor_id='TEST-SENSOR-001' AND day='2026-10-21';
DELETE FROM smartenergy.measurements_by_sensor_day WHERE sensor_id='SENSOR-TEST-002' AND day='2026-10-21';
