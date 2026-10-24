# Entraîner et brancher le modèle de prévision (ai-service)

Procédure cohérente avec tout le projet : docker-compose.yml, les bases (Cassandra smartenergy.measurements_by_sensor_day, MongoDB sensors), les services Java (Collector 8081, Storage 8082, Analytics 8083), l'ai-service (8085) et le front (5173). Commandes Windows (CMD), depuis la racine du dépôt smartenergy-hub.

## 0. Prérequis

| Outil | Pour quoi | Vérifier |
|-------|-----------|----------|
| Docker Desktop | MongoDB, Redis, Cassandra, ai-service | docker info |
| Java 17 | services Spring Boot | java -version |
| Node.js 18+ | scripts scripts/load/ et front | node -v |

Les scripts scripts/load/ arrivent dans develop avec la PR feature/frontend. Avant sa fusion : git checkout feature/frontend.

## 1. Bases de données

```cmd
docker compose up -d mongo redis cassandra
:: première fois seulement : création du keyspace/table Cassandra et des capteurs MongoDB
docker compose up cassandra-init mongo-init
```

Les capteurs créés par scripts/init-mongo.js sont SENSOR-001 (Pmax 8 kW), SENSOR-002 (12 kW), SENSOR-003 (5 kW, inactif). Ce sont ces identifiants qu'utilisent les données, Cassandra, l'Analytics, l'ai-service et le front.

## 2. Services Java (un CMD par service, Java 17)

```cmd
mvnw.cmd -pl storage-service spring-boot:run "-Dspring-boot.run.jvmArguments=-Xmx384m"
mvnw.cmd -pl collector-service spring-boot:run "-Dspring-boot.run.jvmArguments=-Xmx256m"
mvnw.cmd -pl analytics-service spring-boot:run "-Dspring-boot.run.jvmArguments=-Xmx384m"
```

Attendre Started ...Application dans chaque fenêtre.

## 3. Jeu de données d'entraînement

```cmd
node scripts/load/generate-training-data.mjs
```

Capteurs lus dans MongoDB (via GET /api/sensors de l'Analytics), 90 jours, une mesure toutes les 5 min.
Sortie : ai-service/data/raw/dataset.csv (format lu par tous les scripts d'entraînement).
Même profil de mesures que send-measurements.mjs (fichier commun scripts/load/profile.mjs).
Les .csv sont ignorés par Git (.gitignore) : ils ne sont pas versionnés.

## 4. Entraînement (dans le conteneur ai-service)

```cmd
docker compose build ai-service
docker compose run --rm --no-deps ai-service python training/train_forecast_model.py
docker compose run --rm --no-deps ai-service python training/train_anomaly_model.py
:: Optionnel (nécessite TensorFlow) :
docker compose run --rm --no-deps ai-service pip install -r requirements-lstm.txt
docker compose run --rm --no-deps ai-service python training/train_lstm_forecast.py
```

Pourquoi cette commande :
- Les __main__ des scripts d'entraînement sont actifs et entraînent par capteur
- save_model() écrit forecast_model_v{version}_{sensor_id}.joblib ET forecast_model_v1_{sensor_id}.joblib
- docker-compose.yml monte ./ai-service sur /app : les modèles arrivent dans ai-service\artifacts\ sur le PC
- Entraîner dans le conteneur évite un écart de version de scikit-learn entre l'entraînement et le service

Résultat obtenu avec ce jeu de données : MAE 0,13 kW, RMSE 0,17 kW, R² 0,95.

## 5. Historique récent dans Cassandra

La prévision (get_features_from_cassandra) lit les 24 dernières heures du capteur dans Cassandra et exige au moins 24 heures remplies. On les envoie par la vraie chaîne (Collector → Redis → Storage → Cassandra) :

```cmd
node scripts/load/send-measurements.mjs --backfill-hours 24
:: puis, pour que les 24 dernières heures restent remplies, laisser tourner :
node scripts/load/send-measurements.mjs
```

## 6. Lancer l'ai-service

```cmd
docker compose up -d --no-deps ai-service
```

--no-deps : Cassandra est déjà lancée ; sans cette option, Docker attend que Cassandra soit healthy, ce qui peut bloquer (contrôle de santé parfois faux après un redémarrage de Docker Desktop). Dans le conteneur, l'ai-service joint Cassandra par CASSANDRA_HOST=cassandra (déjà dans docker-compose.yml).

## 7. Vérifier

```cmd
curl http://localhost:8085/health
curl -X POST http://localhost:8085/api/v1/forecasts/predict -H "Content-Type: application/json" -d "{\"sensor_id\":\"SENSOR-001\",\"horizon_minutes\":60}"
```

| Réponse | Cause |
|---------|-------|
| 200 avec predicted_power_kw | ✅ |
| 503 « Modèle de prévision non disponible » | fichiers _v1_{sensor_id}.joblib absents (étape 4) |
| 422 « Données insuffisantes » | moins de 24 h de mesures du capteur dans Cassandra (étape 5) |
| 500 | voir docker compose logs ai-service |

Puis le front : cd frontend, npm install, npm run dev, écran Prévision sur http://localhost:5173.

## Points corrigés dans ai-service

- ✅ to_hourly() (app/preprocessing/features.py) conserve sensor_id : entraînement par capteur, pas de mélange des profils
- ✅ Le modèle d'anomalies (Isolation Forest) est chargé et utilisé dans InferenceService en plus des règles métier
- ✅ Les fichiers .joblib, .keras, .pkl sont ignorés par Git (.gitignore créé)
- ✅ Les scripts d'entraînement utilisent dataset.csv (plus de forecast_dataset.csv)
- ✅ Les __main__ des scripts sont actifs et entraînent par capteur
- ✅ Les services chargent les modèles par capteur (forecast_model_v1_{sensor_id}.joblib)
