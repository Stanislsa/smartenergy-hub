# AI Service - SmartEnergy Hub

Service Python pour la détection d'anomalies énergétiques, la prévision de consommation et l'analyse d'efficacité.

## Architecture

```
ai-service/
├── app/
│   ├── main.py              # Point d'entrée FastAPI
│   ├── api/                 # Endpoints REST
│   │   ├── health.py
│   │   ├── anomalies.py
│   │   ├── forecasts.py         # Random Forest (court terme)
│   │   ├── lstm_forecasts.py    # LSTM (long terme)
│   │   ├── alerts.py            # Alertes avec recommandations
│   │   ├── efficiency.py        # Analyse efficacité
│   │   └── model_status.py
│   ├── schemas/            # Schémas Pydantic
│   │   ├── measurement.py
│   │   ├── prediction.py
│   │   ├── alert.py
│   │   └── efficiency.py
│   ├── services/            # Logique métier
│   │   ├── inference_service.py
│   │   ├── forecast_service.py
│   │   ├── lstm_forecast_service.py
│   │   ├── alert_service.py
│   │   ├── efficiency_service.py
│   │   └── cassandra_service.py   # Intégration Cassandra
│   ├── models/              # Modèles ML
│   │   └── anomaly_detector.py
│   └── core/                # Configuration
│       └── config.py
├── training/               # Scripts d'entraînement
│   ├── train_forecast_model.py    # Random Forest
│   └── train_lstm_forecast.py      # LSTM
├── artifacts/              # Modèles entraînés (versionnés)
│   ├── anomaly_detector/
│   ├── forecast_model/
│   └── lstm_forecast_model/
├── tests/                  # Tests pytest
│   ├── test_health.py
│   ├── test_anomalies.py
│   ├── test_forecasts.py
│   ├── test_alerts.py
│   └── test_efficiency.py
├── requirements.txt
├── .env.example
└── README.md
```

## Technologies

- Python 3.10+
- FastAPI
- Pydantic v2
- scikit-learn
- TensorFlow (pour LSTM)
- pandas
- NumPy
- cassandra-driver
- pytest

## Configuration

Copier `.env.example` vers `.env` et configurer les variables d'environnement :

```bash
cp .env.example .env
```

Variables importantes :
- `CASSANDRA_HOST`: Host Cassandra (défaut: localhost)
- `CASSANDRA_PORT`: Port Cassandra (défaut: 9042)
- `CASSANDRA_KEYSPACE`: Keyspace Cassandra (défaut: smartenergy)
- `CASSANDRA_USERNAME`: Username Cassandra (optionnel)
- `CASSANDRA_PASSWORD`: Password Cassandra (optionnel)

## Installation

```bash
pip install -r requirements.txt
```

## Démarrage

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8085
```

## Endpoints

### Health
- `GET /health` - Vérifier l'état du service

### Anomalies
- `POST /api/v1/anomalies/predict` - Détecter anomalie sur une mesure

### Prévisions
- `POST /api/v1/forecasts/predict` - Prévision Random Forest (court terme)
- `POST /api/v1/lstm-forecasts/predict` - Prévision LSTM (long terme)
- `GET /api/v1/lstm-forecasts/info` - Informations modèle LSTM

### Alertes
- `POST /api/v1/alerts/` - Générer alerte avec explications et recommandations
- `GET /api/v1/alerts/{sensor_id}` - Historique alertes par capteur
- `GET /api/v1/alerts/active` - Alertes actives (24h)

### Efficacité
- `GET /api/v1/efficiency/{sensor_id}?period_days=30` - Analyse efficacité énergétique

### Modèle
- `GET /api/v1/model/status` - État du modèle d'anomalie

## Entraînement des Modèles

### Random Forest (Prévisions court terme)
```bash
cd training
python train_forecast_model.py
```

### LSTM (Prévisions long terme)
```bash
cd training
python train_lstm_forecast.py
```

## Intégration Cassandra

Le service se connecte automatiquement à Cassandra pour récupérer les données historiques :
- **EfficiencyService** : Compare consommation actuelle vs historique
- **ForecastService** : Récupère features de lag depuis l'historique

Si Cassandra est indisponible, le service utilise des données en mémoire (fallback).

## Port

Port par défaut : 8085
