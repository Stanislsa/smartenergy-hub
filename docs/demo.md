# Scénario de démonstration de bout en bout

Livrable 10 du sujet : « une démonstration fonctionnelle de bout en bout ». Durée visée : 10 à 12 minutes.
Le fil conducteur suit les questions du scénario fonctionnel (sujet §5) auxquelles le système doit répondre.
Commandes Windows (CMD), depuis la racine du dépôt.

## 0. Préparation (avant la soutenance, 15 min)

| # | Action | Commande / vérification |
|---|---|---|
| 1 | Bases de données | `docker compose --profile ai up -d mongo redis cassandra` (première fois : `docker compose --profile ai up cassandra-init mongo-init`) |
| 2 | Vérifier que Cassandra répond | `docker compose --profile ai exec cassandra cqlsh -e "DESCRIBE KEYSPACES"` |
| 3 | Services Java, un terminal chacun, dans cet ordre | `mvn -pl storage-service spring-boot:run`, puis `mvn -pl collector-service spring-boot:run`, puis `mvn -pl analytics-service spring-boot:run` |
| 4 | Service IA (écran Prévision) | `docker compose --profile ai up -d ai-service`, modèles entraînés selon `ai-service/TRAINING_PROCEDURE.md` |
| 5 | Front | `cd frontend`, `npm install`, `npm run dev` → http://localhost:5173 |
| 6 | Historique récent (24 h pour la prévision Random Forest, 168 h pour le LSTM) | `node scripts/load/send-measurements.mjs --backfill-hours 168` |
| 7 | Contrôle | écran **Tableau de bord** : tous les services « En ligne » |

Garder ouverts : le front, un terminal libre, la fenêtre du Storage.

## 1. Architecture (1 min)

Schéma : capteurs → Collector (8081) → Redis Streams `energy-measurements` → Storage (8082) → Cassandra
(mesures) ; MongoDB (capteurs, résumés quotidiens) ; Analytics (8083) ; service IA (8085) ; front (5173).

## 2. Une mesure traverse toute la chaîne (2 min)

```cmd
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-valid.json
docker compose --profile ai exec redis redis-cli XLEN energy-measurements
```

Montrer : `HTTP/1.1 202`, le flux Redis qui s'allonge, le log « Mesure persistée dans Cassandra » dans la fenêtre du
Storage, puis la mesure dans l'écran **Historique** (SENSOR-002).

Mesure invalide (sujet 22.3, n° 2) :

```cmd
curl -i -X POST http://localhost:8081/api/measurements -H "Content-Type: application/json" -d @scripts/test-data/measure-no-sensor.json
```

Montrer : `HTTP/1.1 400` avec `sensorId : ne doit pas être vide`, et rien de publié dans Redis.

## 3. Les capteurs émettent en continu (1 min)

```cmd
node scripts/load/send-measurements.mjs --spike 0.02
```

Laisser tourner pendant la suite (1 mesure/s, 2 % de pics). Montrer le **Tableau de bord** : puissance totale, courbe
des 24 h, anomalies récentes.

## 4. Répondre aux questions du sujet (4 min)

| Question (sujet §5) | Où le montrer | API derrière |
|---|---|---|
| Dernière valeur reçue pour un capteur ? | écran **Capteurs**, colonne « Dernière mesure » | `GET /api/measurements/{id}/latest` |
| Consommation moyenne entre deux dates ? | écran **Résumé quotidien** ou **Historique** (choix des dates) | `GET /api/analytics/{id}/summary?from&to` |
| Quels capteurs dépassent un seuil ? | écran **Anomalies**, méthode « Seuil Pmax » ; pic de 12,5 kW de SENSOR-001 le 22/10 (seuil 8 kW) | `GET /api/analytics/{id}/anomalies/all` |
| Quelle consommation est prévue ? | écran **Prévision** (horizon 6 h) | ai-service `POST /api/v1/forecasts/predict` |
| Quels événements sont anormaux ? | écran **Anomalies** : seuil, z-score (z = 4,79), variation (+247 %), tension, température | idem |

Agrégat MongoDB : écran **Résumé quotidien**, source « Résumé MongoDB » après
`curl -X POST "http://localhost:8083/api/sensors/SENSOR-001/daily-summary/compute?date=2026-10-22"`.

## 5. Panne et reprise (2 min)

1. Arrêter le Storage (Ctrl+C dans sa fenêtre). Le script d'envoi continue : les réponses restent `202`.
2. `docker compose --profile ai exec redis redis-cli XINFO GROUPS energy-measurements` : le `lag` augmente,
   les messages sont conservés.
3. Relancer le Storage : il rattrape les messages en attente (logs « Mesure persistée… »), puis `lag` = 0.
4. Rafraîchir **Historique** : aucune mesure perdue.

Preuves détaillées : `docs/tests.md` n° 5, n° 6, P2 (panne de Cassandra, C8).

## 6. Supervision et documentation (1 min)

- http://localhost:8083/actuator/health : état de MongoDB, Cassandra et Redis.
- http://localhost:8081/actuator/metrics/energy.measurements?tag=outcome:accepted : mesures acceptées.
- Résultats de charge : `docs/monitoring.md` (aucune perte jusqu'à 100 mesures/s ; Storage limité vers 65-70/s).
- Swagger : http://localhost:8083/swagger-ui/index.html (et 8081, 8082).

## 7. Plan B (si un incident survient)

| Symptôme | Cause connue | Action |
|---|---|---|
| Analytics ou Storage : `MongoTimeoutException` au démarrage | MongoDB lent après un démarrage de Docker | `docker compose --profile ai restart mongo`, puis relancer le service |
| `docker compose up` ne démarre rien | services soumis aux profils | ajouter `--profile ai` (bases + IA) ou `--profile all` |
| Docker à 100 % de CPU, interface figée | poste saturé (Cassandra au démarrage) | fermer les autres applications, redémarrer Docker Desktop |
| Écran Prévision : « Service injoignable » ou 422 | ai-service arrêté, ou moins de 24 h / 168 h de mesures | lancer l'ai-service ; `send-measurements.mjs --backfill-hours 168` |
| Courbes vides dans le front | pas de mesures récentes | lancer `send-measurements.mjs` |

Prévoir des captures d'écran de chaque étape en secours.

À revoir après la fusion de la branche `feature/fix-ai-forecast-services` (écran Prévision modifié, prévision LSTM).
