# AI Service - SmartEnergy Hub

Service Python pour la détection d'anomalies énergétiques et la prévision de consommation.

## Architecture

```
ai-service/
├── app/
│   ├── main.py              # Point d'entrée FastAPI
│   ├── api/                 # Endpoints REST
│   │   ├── health.py
│   │   ├── anomalies.py
│   │   └── forecasts.py
│   ├── schemas/            # Schémas Pydantic
│   │   ├── measurement.py
│   │   └── prediction.py
│   ├── services/            # Logique métier
│   │   ├── inference_service.py
│   │   └── data_service.py
│   ├── preprocessing/       # Préparation des données
│   │   └── features.py
│   ├── models/              # Modèles ML
│   │   └── anomaly_detector.py
│   └── core/                # Configuration
│       └── config.py
├── training/               # Scripts d'entraînement
│   ├── train_anomaly_model.py
│   ├── evaluate_model.py
│   └── build_dataset.py
├── artifacts/              # Modèles entraînés (versionnés)
│   └── README.md
├── tests/                  # Tests pytest
│   ├── test_health.py
│   ├── test_anomalies.py
│   ├── test_preprocessing.py
│   └── test_model.py
├── requirements.txt
├── Dockerfile
└── README.md
```

## Technologies

- Python 3.10+
- FastAPI
- Pydantic
- scikit-learn
- pandas
- NumPy
- pytest

## Port

Port par défaut : 8085

## Endpoints

- GET /health
- GET /api/v1/model/status
- POST /api/v1/anomalies/predict
- POST /api/v1/forecasts
- GET /api/v1/sensors/{sensorId}/analysis
