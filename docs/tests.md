# Tests et preuves — SmartEnergy Hub

Ce document regroupe les preuves de tests demandées par le sujet (section 22) :
scénarios fonctionnels (22.3), tableau de preuve (22.4) et critères de validation
de `docs/api-recomandation.md` (section 6). Responsable : partie D.

## 1. Environnement de test

| Élément | Valeur |
|---|---|
| Bases | `docker compose up -d` : MongoDB (27018), Redis (6380), Cassandra (9042) |
| Initialisation | `scripts/init-cassandra.cql`, `scripts/init-mongo.js` |
| Services | Collector 8081 (Salomi), Storage 8082 (Stan), Analytics 8083 (Lalia, Tiana) |
| Données de test | `scripts/test-data/` (mesures JSON et CQL) |
| Capteur de test | `SENSOR-002` pour la chaîne complète, `SENSOR-001` pour le pic |
| Date d'exécution | 22/10/2026 (n° 4), 24/10/2026 (autres scénarios) |

Lancement des services, un terminal par service, depuis la racine du dépôt :

```cmd
mvnw.cmd -pl storage-service spring-boot:run "-Dspring-boot.run.jvmArguments=-Xmx384m"
mvnw.cmd -pl collector-service spring-boot:run "-Dspring-boot.run.jvmArguments=-Xmx256m"
mvnw.cmd -pl analytics-service spring-boot:run "-Dspring-boot.run.jvmArguments=-Xmx384m"
```

Commandes de vérification utilisées dans les scénarios :

```cmd
:: Redis : longueur du flux, état du groupe, messages en attente
docker compose exec redis redis-cli XLEN energy-measurements
docker compose exec redis redis-cli XINFO GROUPS energy-measurements
docker compose exec redis redis-cli XPENDING energy-measurements storage-group

:: Cassandra : mesures de SENSOR-002 pour le 23/10/2026
docker compose exec cassandra cqlsh -e "SELECT measured_at, power_kw, voltage, temperature FROM smartenergy.measurements_by_sensor_day WHERE sensor_id='SENSOR-002' AND day='2026-10-23'"
```

## 2. Tableau de preuve (sujet 22.4)

| N° | Scénario | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|
| 1 | Envoi d'une mesure valide | HTTP 202 + événement Redis | 202, message dans `energy-measurements`, mesure de 20:00Z enregistrée dans Cassandra | ✅ |
| 2 | Mesure sans sensorId | HTTP 400 | 400 `Validation failed`, `sensorId : ne doit pas être vide` | ✅ |
| 3 | Lecture historique | Liste ordonnée de mesures | 200, mesures de SENSOR-002 de la plus récente à la plus ancienne | ✅ |
| 4 | Injection d'un pic | Anomalie détectée | Pic de 12,5 kW détecté à 18:00Z par le seuil (> 8 kW), le z-score (z = 4,79) et la variation (+247 %) | ✅ |
| 5 | Arrêt Storage Service | Messages conservés dans Redis | 3 × 202, `lag` = 3 dans Redis, Cassandra inchangé | ✅ |
| 6 | Redémarrage | Reprise du traitement | Les 3 mesures (20:05, 20:10, 20:15) enregistrées dès le démarrage du Storage, `pending` = 0 | ✅ |

## 3. Scénarios fonctionnels obligatoires (sujet 22.3)

| Scénario 22.3 | Couvert par |
|---|---|
| 1. Envoyer une mesure valide | Tableau, n° 1 |
| 2. Envoyer une mesure invalide | Tableau, n° 2 |
| 3. Rechercher l'historique d'un capteur | Tableau, n° 3 |
| 4. Simuler une anomalie | Tableau, n° 4 |
| 5. Arrêter temporairement un service | Tableau, n° 5 |
| 6. Redémarrer le système | Tableau, n° 6 |
| 7. Vérifier la persistance des données | Section 5, P1 |

## 4. Procédures détaillées

### N° 1 — Envoi d'une mesure valide

```cmd
docker compose exec redis redis-cli XLEN energy-measurements
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-valid.json
docker compose exec redis redis-cli XLEN energy-measurements
```

Attendu : `HTTP/1.1 202`, XLEN augmente de 1, puis la mesure de 20:00:00Z apparaît dans Cassandra.

Obtenu (24/10/2026) : `202` ; log du Storage `Mesure persistée dans Cassandra : capteur=SENSOR-002, timestamp=2026-10-23T20:00:00Z` ;
la mesure est relue par le n° 3. ✅

### N° 2 — Mesure sans sensorId

```cmd
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-no-sensor.json
docker compose exec redis redis-cli XLEN energy-measurements
```

Attendu : `HTTP/1.1 400`, corps `{"status":400,"error":"Validation failed","details":["sensorId : ne doit pas être vide"]}`, XLEN inchangé.

Obtenu (24/10/2026) : `400`, corps `{"details":["sensorId : ne doit pas être vide"],"status":400,"error":"Validation failed"}`.
XLEN = 5 après les n° 1, P3 et les 3 mesures du n° 5 : la mesure invalide n'a pas été publiée. ✅

### N° 3 — Lecture historique

```cmd
curl "http://localhost:8083/api/measurements/SENSOR-002?from=2026-10-23T19:00:00Z&to=2026-10-23T21:00:00Z"
```

Attendu : liste des mesures de SENSOR-002, de la plus récente à la plus ancienne.

Obtenu (24/10/2026, après le n° 6) : `200`, 4 mesures dans l'ordre 20:15, 20:10, 20:05, 20:00 (ordre décroissant
de la clé de clustering `measured_at`). ✅

### N° 4 — Injection d'un pic ✅

Données : `scripts/test-data/spike-sensor-001.cql`, 24 mesures de SENSOR-001 (22/10/2026, 17h00 à 18h55 UTC,
une toutes les 5 min, autour de 3,6 kW) avec un pic de 12,5 kW à 18h00.

```cmd
docker compose cp scripts/test-data/spike-sensor-001.cql cassandra:/tmp/spike.cql
docker compose exec cassandra cqlsh -f /tmp/spike.cql
curl "http://localhost:8083/api/analytics/SENSOR-001/summary?from=2026-10-22T17:00:00Z&to=2026-10-22T19:00:00Z"
curl "http://localhost:8083/api/analytics/SENSOR-001/anomalies/all?from=2026-10-22T17:00:00Z&to=2026-10-22T19:00:00Z"
```

Obtenu (22/10/2026) :

| Indicateur | Attendu | Obtenu |
|---|---|---|
| measurementCount | 24 | 24 |
| maxPowerKw | 12,5 | 12,5 |
| avgPowerKw | ≈ 4,029 | 4,029 |
| energyKwh | ≈ 7,75 | 7,75 |
| thresholdExceedances | 1 | 1 |
| Anomalies | THRESHOLD, Z_SCORE, POWER_VARIATION à 18:00Z | THRESHOLD (score 1,563), Z_SCORE (z = 4,787), POWER_VARIATION (+247,2 %) à 18:00Z ; VOLTAGE 0, TEMPERATURE 0 |

### N° 5 — Arrêt du Storage Service

1. Arrêter le Storage (Ctrl+C dans son terminal).
2. Envoyer 3 mesures :

```cmd
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-storage-down-1.json
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-storage-down-2.json
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-storage-down-3.json
```

3. Vérifier Redis (XLEN, XINFO GROUPS) et Cassandra.

Attendu : 3 × `202`, XLEN +3, les 3 messages restent dans le flux (groupe en retard de 3), Cassandra inchangé.

Obtenu (24/10/2026) : 3 × `202`. `check.cmd` pendant l'arrêt :

| Indicateur | Valeur |
|---|---|
| XLEN | 5 |
| `entries-read` | 2 |
| `lag` | 3 |
| `pending` | 0 |
| Cassandra | 1 ligne (20:00) |

Les 3 messages sont conservés dans le flux et pas encore lus par `storage-group`. ✅

### N° 6 — Redémarrage

1. Relancer le Storage.
2. Attendre quelques secondes, puis vérifier Cassandra et `XPENDING`.

Attendu : les mesures de 20:05, 20:10 et 20:15 apparaissent dans Cassandra, `XPENDING` = 0.

Obtenu (24/10/2026) : le Storage démarre en 9,9 s, puis enregistre immédiatement 20:05, 20:10 et 20:15
(logs `Mesure persistée dans Cassandra`). Le n° 3 relit les 4 mesures. ✅

## 5. Critères de validation (`docs/api-recomandation.md`, section 6)

| Code | Critère | Procédure | Résultat |
|---|---|---|---|
| C1 | Le Collector accepte une mesure valide et la publie dans Redis | N° 1 | ✅ |
| C2 | Le message apparaît dans `energy-measurements` | N° 1 (XLEN) | ✅ |
| C3 | Le consommateur lit le message avec `storage-group` | N° 1 (XINFO GROUPS) | ✅ |
| C4 | La mesure est enregistrée dans Cassandra | N° 1 (CQL) | ✅ |
| C5 | La mesure peut être relue par capteur et par jour | N° 3 | ✅ |
| C6 | L'ACK est exécuté après l'écriture | N° 1 (XPENDING = 0) | ✅ |
| C7 | Une panne temporaire de Cassandra ne provoque pas de perte silencieuse | P2 | ✅ erreur loguée, message conservé en attente |
| C8 | Le consommateur reprend les messages en attente | N° 6 et P2 | ❌ n° 6 OK, mais P2 : le message en attente n'est jamais relu |
| C9 | Une nouvelle tentative ne provoque pas de doublon logique | P3 | ✅ |

### P1 — Persistance après redémarrage du système (22.3, n° 7)

```cmd
docker compose restart
```

Puis relancer la requête Cassandra de SENSOR-002. Attendu : les mesures sont toujours présentes
(volumes Docker conservés ; ne pas utiliser `docker compose down -v`).

Obtenu (24/10/2026) : après `docker compose restart`, Redis a conservé le flux (XLEN = 7, message de 20:20 toujours en attente)
et Cassandra contient toujours les 5 mesures de SENSOR-002 (20:00 à 20:25). ✅

### P2 — Panne temporaire de Cassandra (C7, C8)

```cmd
docker compose stop cassandra
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-cassandra-down.json
docker compose exec redis redis-cli XPENDING energy-measurements storage-group
docker compose start cassandra
:: une fois Cassandra revenue, mesure témoin
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-after-cassandra.json
```

Après le redémarrage de Cassandra, vérifier si la mesure de 20:20 arrive dans Cassandra.

Attendu (critères C7 et C8) : `202`, message en attente (non acquitté) pendant la panne, puis enregistré après le retour de Cassandra.

Obtenu (24/10/2026) :

| Étape | Résultat |
|---|---|
| Envoi de 20:20 pendant la panne | `202` |
| Storage | erreur `NoNodeAvailableException` dans les logs, pas d'ACK |
| Redis | `pending` = 1 (message de 20:20 attribué à `storage-consumer-1`) |
| Après le retour de Cassandra | 20:20 **absente** de Cassandra |
| Mesure témoin 20:25 envoyée après le retour | enregistrée |
| Après `docker compose restart` | 20:20 toujours en attente (`pending` = 1) |

C7 ✅ : pas de perte silencieuse (erreur loguée, message conservé dans Redis).
C8 ❌ : le message en attente n'est jamais retraité ; seuls les nouveaux messages sont lus. Voir Observations.

### P3 — Doublon (C9, sujet 15.1 « idempotence »)

Renvoyer exactement la même mesure que le n° 1 :

```cmd
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-valid.json
```

Attendu : `202`, XLEN +1, mais toujours **une seule** ligne à 20:00:00Z dans Cassandra
(même clé primaire `((sensor_id, day), measured_at)` : l'écriture remplace la ligne existante).

Obtenu (24/10/2026) : `202`, deux logs `Mesure persistée` pour 20:00 (deux `RecordId` différents),
mais la lecture renvoie **une seule** mesure à 20:00:00Z. ✅

## 6. Tests unitaires

| Service | Tests | Résultat |
|---|---|---|
| analytics-service | 65 (calculs, anomalies, lecture Cassandra, service, contrôleurs) | ✅ BUILD SUCCESS |
| collector-service | 8 (validation du DTO, d'après la PR #10) | ⏳ à relancer |
| storage-service | aucun (Maven : `No sources to compile` pour les tests) | — |

## 7. Observations

Exécution du 24/10/2026. Les requêtes HTTP ont été envoyées depuis un navigateur (`fetch`) avec les mêmes
`sensorId`, `timestamp` et `powerKw` que les fichiers de `scripts/test-data/` ; les vérifications Redis et
Cassandra ont été faites avec `docker compose exec` (XLEN, XINFO GROUPS, XPENDING, cqlsh).

1. **Messages en attente jamais relus (C8, partie B).** `RedisStreamConsumer` lit uniquement les nouveaux
   messages (`ReadOffset.lastConsumed()`, soit `>`). Un message lu puis non acquitté (échec Cassandra) reste dans
   la liste des messages en attente du groupe et n'est plus jamais retraité, même après le retour de Cassandra
   ou un redémarrage. Piste : relire au démarrage et périodiquement les messages en attente du consommateur
   (lecture avec l'offset `0`, ou `XAUTOCLAIM`) avant les nouveaux.
2. **Arrêt du Storage (n° 5, n° 6).** Fonctionne : les messages non lus restent dans le flux (`lag`) et sont
   traités au redémarrage. La différence avec P2 : ici les messages n'avaient jamais été lus.
3. **Idempotence (C9).** Assurée par la clé primaire Cassandra : un renvoi écrase la ligne. Le `record_id` (UUID)
   change à chaque écriture, il ne sert donc pas à identifier une mesure.
4. **Analytics pendant le redémarrage de Cassandra.** `GET /api/measurements/...` répond `500 Internal Server Error`
   tant que Cassandra n'est pas disponible. Un `503` avec un message clair serait plus explicite.
5. **Santé des conteneurs.** Après un redémarrage de Docker Desktop, Cassandra et MongoDB ont été affichés
   `unhealthy` alors qu'ils répondaient ; attendre que `cqlsh` réponde est plus fiable que l'état Docker.
6. **Actuator.** Disponible sur le Collector (`/actuator/health` = `UP`), absent de l'Analytics (404) :
   à ajouter avec le monitoring (Étape 11).
