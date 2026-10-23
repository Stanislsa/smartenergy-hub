# Changements effectués - Correction des problèmes IA

## 🔴 Priorité Haute (Indispensables)

### 1. Requête Cassandra corrigée
**Fichier** : `app/services/cassandra_service.py`

**Problème** : La table `measurements` n'existe pas, et la colonne `day` manque.

**Solution** :
- Utilisation de `measurements_by_sensor_day` avec requête par jour UTC
- Boucle sur les jours pour récupérer toutes les mesures
- Tri chronologique avant retour
- Vérification : `cassandra_keyspace = "smartenergy"` dans `config.py`

```python
QUERY = ("SELECT sensor_id, measured_at, power_kw, voltage, temperature "
         "FROM measurements_by_sensor_day "
         "WHERE sensor_id = ? AND day = ? AND measured_at >= ? AND measured_at < ?")
```

### 2. Suppression des fausses données
**Fichiers** : `app/services/forecast_service.py`, `app/api/forecasts.py`

**Problème** : Si Cassandra ne renvoie rien, `_get_default_features()` fournit des valeurs codées en dur.

**Solution** :
- Suppression de `_get_default_features()`
- Levée de `ValueError` si données insuffisantes (< 24h)
- API renvoie HTTP 422 avec message explicite
- Les erreurs Cassandra remontent en 500 (pas cachées)

### 3. Regroupement horaire pour les lags
**Fichiers** : `app/preprocessing/features.py`, `training/train_forecast_model.py`, `training/train_lstm_forecast.py`, `app/services/forecast_service.py`

**Problème** : Les lags 1, 2, 3, 6, 12, 24 supposent une mesure par heure, mais les données sont toutes les 5 minutes.

**Solution** :
- Création de la fonction partagée `to_hourly()` dans `features.py`
- Regroupement par heure avec `resample("1h").mean()`
- Interpolation des trous courts (`interpolate(limit=2)`)
- Utilisation dans tous les scripts d'entraînement et le service de prévision

## 🟠 Priorité Moyenne

### 4. Calcul d'énergie supprimé
**Fichier** : `app/services/cassandra_service.py`

**Problème** : `get_aggregated_consumption()` donnait un résultat ~288x trop grand.

**Solution** : Suppression de la fonction. L'énergie est calculée côté Java (Analytics Service) via `GET /api/analytics/{sensorId}/summary`.

### 5. Endpoint LSTM avec vraies données
**Fichiers** : `app/api/lstm_forecasts.py`, `app/services/lstm_forecast_service.py`

**Problème** : Utilisait une séquence factice `[[5.0, 230.0, 35.0, ...]] * 168`.

**Solution** :
- Récupération des 168 dernières heures depuis Cassandra
- Regroupement horaire avec `to_hourly()`
- Création des features temporelles
- Erreur 422 si moins de 168h disponibles

### 6. TensorFlow optionnel
**Fichiers** : `requirements.txt`, `requirements-lstm.txt`, `app/services/lstm_forecast_service.py`, `app/main.py`

**Problème** : TensorFlow (plusieurs centaines de Mo) ingérable sur PC avec 8 Go RAM.

**Solution** :
- Retrait de `tensorflow` de `requirements.txt`
- Création de `requirements-lstm.txt` pour l'entraînement local
- Import conditionnel de TensorFlow avec `try/except ImportError`
- Route LSTM inclue seulement si TensorFlow disponible
- Message d'erreur clair si TensorFlow manquant

## 🟡 Priorité Basse

### 7. Générateur de données synthétiques
**Fichier** : `training/generate_synthetic_data.py`

**Problème** : Aucun dataset disponible pour l'entraînement.

**Solution** :
- Script générant des mesures horaires synthétiques
- Format : `sensor_id, measured_at (UTC), power_kw, voltage, temperature, is_anomaly, anomaly_type`
- Patterns journaliers (pic matin/soir) et hebdomadaires (weekend)
- 5% d'anomalies avec différents types
- 30 jours de données par défaut

### 8. Intégration Docker
**Fichier** : `docker-compose.yml`

**Ajouts** :
- Service `ai-service` avec build depuis `ai-service/Dockerfile`
- Port 8085 exposé
- `CASSANDRA_HOST=cassandra` (nom du service Docker)
- Dépendance sur `cassandra` avec healthcheck
- Volume pour le développement local

## Documentation

- `ARCHITECTURE.md` : Justification du service Python séparé vs ONNX/DJL dans Java
- `CHANGES.md` : Ce fichier, récapitulatif des corrections

## Ordre d'utilisation

1. Démarrer l'infrastructure : `docker-compose up -d cassandra`
2. Initialiser Cassandra : `cqlsh -f scripts/init-cassandra.cql`
3. Générer des données synthétiques : `python training/generate_synthetic_data.py`
4. Entraîner le modèle Random Forest : `python training/train_forecast_model.py`
5. Démarrer le service AI : `docker-compose up ai-service` (ou `uvicorn app.main:app` en local)
6. Tester la prévision : `POST /api/v1/forecasts/predict`

Pour LSTM (optionnel) :
1. Installer TensorFlow : `pip install -r requirements-lstm.txt`
2. Entraîner : `python training/train_lstm_forecast.py`
3. Tester : `POST /api/v1/lstm-forecasts/predict`
