-- Données de test : SENSOR-001, 22/10/2026 de 17h00 à 18h55 UTC, une mesure toutes les 5 min,
-- avec un pic de 12,5 kW à 18h00 (scénario 4 : injection d'un pic).
USE smartenergy;
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:00:00+0000', 3.6, 229.0, 29.0, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:05:00+0000', 3.7, 229.6, 29.4, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:10:00+0000', 3.5, 230.2, 29.8, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:15:00+0000', 3.8, 230.8, 30.2, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:20:00+0000', 3.6, 231.4, 29.0, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:25:00+0000', 3.7, 229.0, 29.4, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:30:00+0000', 3.9, 229.6, 29.8, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:35:00+0000', 3.6, 230.2, 30.2, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:40:00+0000', 3.5, 230.8, 29.0, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:45:00+0000', 3.7, 231.4, 29.4, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:50:00+0000', 3.8, 229.0, 29.8, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 17:55:00+0000', 3.6, 229.6, 30.2, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:00:00+0000', 12.5, 230.2, 29.0, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:05:00+0000', 3.7, 230.8, 29.4, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:10:00+0000', 3.5, 231.4, 29.8, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:15:00+0000', 3.6, 229.0, 30.2, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:20:00+0000', 3.8, 229.6, 29.0, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:25:00+0000', 3.7, 230.2, 29.4, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:30:00+0000', 3.6, 230.8, 29.8, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:35:00+0000', 3.5, 231.4, 30.2, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:40:00+0000', 3.7, 229.0, 29.0, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:45:00+0000', 3.8, 229.6, 29.4, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:50:00+0000', 3.6, 230.2, 29.8, uuid());
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, temperature, record_id) VALUES ('SENSOR-001', '2026-10-22', '2026-10-22 18:55:00+0000', 3.7, 230.8, 30.2, uuid());
