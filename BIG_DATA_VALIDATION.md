# Big Data Validation - SmartEnergy Hub

## Phase 3 - Audit et Validation des Technologies Big Data

### Architecture constatée

#### Technologies Big Data identifiées

| Technologie | Version | Port | Rôle | État |
|-------------|---------|------|------|------|
| Redis | 7 | 6380 | Buffer de messages (Streams) | Configuré |
| Cassandra | 5 | 9042 | Stockage séries temporelles | Configuré |
| MongoDB | 7 | 27018 | Métadonnées capteurs, résumés | Configuré |
| Kafka | - | - | Non configuré | NON APPLICABLE |

#### Services Backend

| Service | Port | Technologie | Rôle | Dépendances |
|---------|------|-------------|------|-------------|
| Collector | 8081 | Spring Boot | Réception mesures → Redis Stream | Redis |
| Storage | 8082 | Spring Boot | Redis Stream → Cassandra | Redis, MongoDB, Cassandra |
| Analytics | 8083 | Spring Boot | Calculs anomalies, résumés | MongoDB, Cassandra, Redis |
| AI | 8085 | FastAPI | Prévisions ML | Cassandra |

---

### Flux de données réels

#### Flux 1 : Collecte → Stockage (Redis → Cassandra)

1. **Collector Service** (port 8081)
   - Endpoint : `POST /api/measurements`
   - Producteur : `MeasurementPublisher.java`
   - Stream Redis : `energy-measurements`
   - Champs publiés : sensorId, timestamp, powerKw, voltage, current, frequency, temperature

2. **Redis Stream** (port 6380)
   - Stream : `energy-measurements`
   - Consumer group : `storage-group`
   - Consumer : `storage-consumer-1`
   - Comportement : Messages non acquittés sont retraités

3. **Storage Service** (port 8082)
   - Consommateur : `RedisStreamConsumer.java`
   - Fréquence : 1 seconde (`@Scheduled(fixedDelay = 1000)`)
   - Persistance : `CassandraMeasurementService.java`
   - ACK : Après écriture réussie dans Cassandra

4. **Cassandra** (port 9042)
   - Keyspace : `smartenergy`
   - Table : `measurements_by_sensor_day`
   - Clé de partition : `(sensor_id, day)`
   - Clustering : `measured_at DESC`
   - Compaction : `TimeWindowCompactionStrategy`

#### Flux 2 : Lecture → Analytics (Cassandra → MongoDB)

1. **Analytics Service** (port 8083)
   - Lecture Cassandra : `measurements_by_sensor_day`
   - Calculs : anomalies, résumés journaliers
   - Écriture MongoDB : `sensors`, `daily_summaries`
   - Source configurée : `analytics.measurement-source=cassandra`

#### Flux 3 : Prévisions IA (Cassandra → ML)

1. **AI Service** (port 8085)
   - Lecture Cassandra : données historiques
   - Modèle : Random Forest / LSTM
   - Endpoint : `POST /ai/api/v1/forecasts/predict`
   - Endpoint statut : `GET /ai/api/v1/model/status`

---

### Kafka

**Conclusion : Kafka n'est PAS intégré dans l'architecture actuelle.**

- Aucun service Kafka dans `docker-compose.yml`
- Aucune configuration Kafka dans `application.properties`
- Redis Streams est utilisé à la place de Kafka
- **Statut : NON APPLICABLE**

---

### Matrice de validation

#### A - Redis

| Test | Méthode | Résultat | Preuve |
|------|---------|----------|--------|
| Disponibilité | `docker-compose ps redis` | NON TESTÉ | - |
| Écriture | `XADD energy-measurements * sensorId TEST timestamp ...` | NON TESTÉ | - |
| Lecture | `XRANGE energy-measurements - +` | NON TESTÉ | - |
| Consumer group | `XINFO GROUPS energy-measurements` | NON TESTÉ | - |
| Structure | Vérifier stream `energy-measurements` | VALIDÉ (code) | `MeasurementPublisher.java` |
| Comportement après redémarrage | NON TESTÉ | - | - |
| Logs | `docker-compose logs redis` | NON TESTÉ | - |

**Statut global : PARTIELLEMENT VALIDÉ (configuration uniquement)**

#### B - Cassandra

| Test | Méthode | Résultat | Preuve |
|------|---------|----------|--------|
| Disponibilité | `docker-compose ps cassandra` | NON TESTÉ | - |
| Écriture | `INSERT INTO measurements_by_sensor_day ...` | NON TESTÉ | - |
| Lecture | `SELECT * FROM measurements_by_sensor_day ...` | NON TESTÉ | - |
| Structure | Vérifier keyspace et tables | VALIDÉ (code) | `init-cassandra.cql` |
| Clé de partition | `(sensor_id, day)` | VALIDÉ (code) | `init-cassandra.cql` |
| Clustering | `measured_at DESC` | VALIDÉ (code) | `init-cassandra.cql` |
| Horodatages | UTC (Instant) | VALIDÉ (code) | `CassandraMeasurementService.java` |
| Comportement après redémarrage | NON TESTÉ | - | - |
| Logs | `docker-compose logs cassandra` | NON TESTÉ | - |

**Statut global : PARTIELLEMENT VALIDÉ (configuration uniquement)**

#### C - MongoDB

| Test | Méthode | Résultat | Preuve |
|------|---------|----------|--------|
| Disponibilité | `docker-compose ps mongo` | NON TESTÉ | - |
| Écriture | `db.sensors.insertOne(...)` | NON TESTÉ | - |
| Lecture | `db.sensors.find(...)` | NON TESTÉ | - |
| Collections | `sensors`, `daily_summaries` | VALIDÉ (code) | `init-mongo.js` |
| Index | `@Indexed` + auto-index-creation | VALIDÉ (code) | `analytics-service/application.properties` |
| Données nécessaires | sensorId, name, building, maxPowerKw, active | VALIDÉ (code) | `init-mongo.js` |
| Résumé journalier | date, avgPowerKw, maxPowerKw, energyKwh, anomalyCount | VALIDÉ (code) | `init-mongo.js` |
| Comportement après redémarrage | NON TESTÉ | - | - |
| Logs | `docker-compose logs mongo` | NON TESTÉ | - |

**Statut global : PARTIELLEMENT VALIDÉ (configuration uniquement)**

#### D - Kafka

| Test | Méthode | Résultat | Preuve |
|------|---------|----------|--------|
| Disponibilité | - | NON APPLICABLE | Non configuré |
| Écriture | - | NON APPLICABLE | Non configuré |
| Lecture | - | NON APPLICABLE | Non configuré |
| Topics | - | NON APPLICABLE | Non configuré |
| Offsets | - | NON APPLICABLE | Non configuré |
| Comportement après redémarrage | - | NON APPLICABLE | Non configuré |

**Statut global : NON APPLICABLE**

---

### Écarts entre architecture documentée et code réel

#### API_MATRIX.md vs Réalité

| Élément documenté | Réalité constatée | Écart |
|------------------|-------------------|-------|
| Kafka mentionné comme technologie Big Data | Kafka non configuré | **ÉCART** |
| Redis Streams comme buffer | Confirmé dans code | OK |
| Cassandra pour séries temporelles | Confirmé dans code | OK |
| MongoDB pour métadonnées | Confirmé dans code | OK |
| Flux Collector → Storage → Analytics | Confirmé dans code | OK |
| Health checks par service | Confirmé dans docker-compose | OK |

**Conclusion : L'architecture documentée mentionne Kafka mais celui-ci n'est pas implémenté. Redis Streams est utilisé à la place.**

---

### Simulateur de mesures

**Fichier :** `simulator/energy_simulator.py`

- Génère des mesures simulées avec : device_id, timestamp, power_kw, voltage, current, frequency
- Diffuse en continu avec intervalle configurable (défaut 1s)
- **Note :** Le simulateur utilise `device_id` mais le Collector attend `sensorId`
- **Écart potentiel** à vérifier lors des tests

---

### Tests à exécuter

#### Test 1 : Démarrage des services

```bash
cd /home/adriano/projets/smartenergy-hub
docker-compose up -d
```

Vérifier :
- `docker-compose ps` : tous les services doivent être "healthy"
- `docker-compose logs collector-service`
- `docker-compose logs storage-service`
- `docker-compose logs analytics-service`
- `docker-compose logs ai-service`

#### Test 2 : Redis Stream

```bash
# Vérifier que le stream existe
docker exec -it smartenergy-hub-redis-1 redis-cli XINFO STREAMS energy-measurements

# Vérifier le consumer group
docker exec -it smartenergy-hub-redis-1 redis-cli XINFO GROUPS energy-measurements

# Envoyer une mesure de test
docker exec -it smartenergy-hub-redis-1 redis-cli XADD energy-measurements * sensorId TEST-001 timestamp $(date -u +%Y-%m-%dT%H:%M:%SZ) powerKw 1.5 voltage 230

# Lire les messages
docker exec -it smartenergy-hub-redis-1 redis-cli XRANGE energy-measurements - +
```

#### Test 3 : Cassandra

```bash
# Se connecter à Cassandra
docker exec -it smartenergy-hub-cassandra-1 cqlsh

# Vérifier le keyspace
DESCRIBE KEYSPACES;

# Utiliser le keyspace
USE smartenergy;

# Vérifier les tables
DESCRIBE TABLES;

# Insérer une mesure de test
INSERT INTO measurements_by_sensor_day (sensor_id, day, measured_at, power_kw, voltage, current, frequency, temperature, record_id)
VALUES ('TEST-001', '2026-10-24', toTimestamp(now()), 1.5, 230, 6.5, 50, 25, uuid());

# Lire la mesure
SELECT * FROM measurements_by_sensor_day WHERE sensor_id='TEST-001' AND day='2026-10-24';
```

#### Test 4 : MongoDB

```bash
# Se connecter à MongoDB
docker exec -it smartenergy-hub-mongo-1 mongosh mongodb://localhost:27017/smartenergy

# Vérifier les collections
show collections;

# Lister les capteurs
db.sensors.find();

# Insérer un capteur de test
db.sensors.updateOne(
  { sensorId: "TEST-001" },
  { $setOnInsert: { sensorId: "TEST-001", name: "Test Sensor", building: "Test Building", maxPowerKw: 10, active: true, createdAt: new Date(), updatedAt: new Date() } },
  { upsert: true }
);

# Lire le capteur
db.sensors.findOne({ sensorId: "TEST-001" });
```

#### Test 5 : Flux de bout en bout

```bash
# 1. Envoyer une mesure via Collector
curl -X POST http://localhost:8081/api/measurements \
  -H "Content-Type: application/json" \
  -d '{
    "sensorId": "TEST-001",
    "timestamp": "2026-10-24T10:00:00Z",
    "powerKw": 1.5,
    "voltage": 230,
    "current": 6.5,
    "frequency": 50,
    "temperature": 25
  }'

# 2. Attendre 2 secondes (traitement Redis → Cassandra)

# 3. Vérifier dans Cassandra
docker exec -it smartenergy-hub-cassandra-1 cqlsh -e "SELECT * FROM smartenergy.measurements_by_sensor_day WHERE sensor_id='TEST-001' AND day='2026-10-24'"

# 4. Vérifier via API Storage
curl http://localhost:8082/api/measurements/TEST-001/latest

# 5. Vérifier via API Analytics
curl http://localhost:8083/api/sensors/TEST-001/daily-summary?date=2026-10-24
```

---

### Problèmes potentiels identifiés

1. **Kafka non implémenté** : L'architecture documentée mentionne Kafka mais il n'est pas configuré. Redis Streams est utilisé à la place.

2. **Simulateur incohérent** : Le simulateur utilise `device_id` mais le Collector attend `sensorId`. À vérifier lors des tests.

3. **Gestion des erreurs Redis** : Le consommateur Redis ne fait qu'acquitter les messages après écriture réussie. Les messages en erreur sont retraités indéfiniment.

4. **TimeWindowCompactionStrategy** : Cassandra utilise TWCS qui peut supprimer des anciennes données. À vérifier pour la rétention.

5. **Health checks** : Les health checks sont configurés mais non testés.

6. **Cassandra arrêté** : Cassandra était en état "Exited (137)" lors de l'audit. Redémarré le 24/10/2026. Cause : probablement un arrêt manuel ou manque de ressources.

---

### Corrections à appliquer (si nécessaire)

1. **Mettre à jour API_MATRIX.md** : Supprimer ou clarifier le statut de Kafka (non implémenté).

2. **Corriger le simulateur** : Changer `device_id` en `sensorId` pour correspondre à l'API Collector.

3. **Ajouter dead-letter queue** : Pour les messages Redis qui échouent après N tentatives.

4. **Configurer la rétention Cassandra** : Documenter la politique de rétention TWCS.

---

### Actions effectuées lors de l'audit (24/10/2026)

1. **Diagnostic Cassandra** : Cassandra était en état "Exited (137)" lors de l'audit initial.
2. **Redémarrage Cassandra** : `docker compose up -d cassandra` - Service redémarré avec succès.
3. **Réinitialisation Cassandra** : `docker compose up cassandra-init` - Tables recréées avec succès.
4. **Redémarrage services dépendants** : `docker compose restart storage-service analytics-service ai-service` - Services redémarrés avec succès (Up 5 minutes).

### État actuel des services (24/10/2026 - 11:35)

| Service | État | Port |
|---------|------|------|
| mongo | Up 8 hours (healthy) | 27018 |
| redis | Up 8 hours (healthy) | 6380 |
| cassandra | Up 21 minutes (healthy) | 9042 |
| collector-service | Up 8 hours | 8081 |
| storage-service | Up 5 minutes | 8082 |
| analytics-service | Up 5 minutes | 8083 |
| ai-service | Up 5 minutes | 8085 |

**Tous les services sont opérationnels.** Les tests de flux peuvent être exécutés.

- [ ] Exécuter les tests de disponibilité des services
- [ ] Exécuter les tests d'écriture/lecture Redis
- [ ] Exécuter les tests d'écriture/lecture Cassandra
- [ ] Exécuter les tests d'écriture/lecture MongoDB
- [ ] Exécuter le test de flux de bout en bout
- [ ] Corriger les problèmes identifiés
- [ ] Mettre à jour la documentation
