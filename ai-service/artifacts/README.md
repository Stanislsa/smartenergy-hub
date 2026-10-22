# Artifacts

Ce dossier contient les modèles entraînés et leurs métadonnées.

## Structure

```
artifacts/
├── anomaly_detector/
│   ├── model_v1.joblib
│   ├── model_v2.joblib
│   └── metadata.json
└── forecasts/
    ├── power_forecast_v1.joblib
    └── metadata.json
```

## Versioning

Les modèles doivent être versionnés avec leur date et numéro de version.

## Ne pas versionner dans Git

Les fichiers .joblib et les modèles binaires ne doivent pas être commités dans Git.
Utilisez un système de stockage externe (S3, MLflow, etc.) pour les modèles en production.
