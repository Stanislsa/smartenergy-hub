# Architecture du Service IA

## Pourquoi un service Python séparé ?

Le sujet (section 18) demande de justifier le choix d'un service Python séparé plutôt que d'utiliser ONNX/DJL dans Java. Voici les raisons :

### 1. **Écosystème ML/IA mature en Python**
- Python est le langage de référence pour le Machine Learning (scikit-learn, TensorFlow, PyTorch)
- Bibliothèques de prétraitement riches (pandas, numpy)
- Outils d'entraînement et d'évaluation standardisés

### 2. **Flexibilité et rapidité de développement**
- Prototypage rapide des modèles
- Facilité d'expérimentation avec différents algorithmes
- Debugging plus simple avec des notebooks Jupyter

### 3. **Séparation des responsabilités**
- Java (Analytics Service) : calculs descriptifs, agrégations, anomalies par règles
- Python (AI Service) : modèles de Machine Learning, prévisions, détection d'anomalies par ML

### 4. **Performance acceptable pour ce cas d'usage**
- Les prévisions ne sont pas en temps réel (batch ou horaire)
- La latence réseau entre services est négligeable comparée au temps d'inférence ML
- Random Forest est très rapide en Python (< 10ms)

### 5. **Maintenance et évolutivité**
- Équipe data science peut travailler indépendamment sur les modèles
- Mise à jour des modèles sans redéployer le service Java
- Possibilité d'ajouter d'autres modèles (LSTM, Prophet, etc.) facilement

### 6. **Alternatives considérées et rejetées**
- **ONNX dans Java** : Complexité d'export/import, perte de flexibilité pour l'entraînement
- **DJL (Deep Java Library)** : Écosystème moins mature, moins de modèles pré-entraînés
- **Kubernetes avec sidecar** : Surcharge architecturale inutile pour ce projet

## Architecture actuelle

```
┌─────────────────┐
│  Simulator      │
│  (Python)       │
└────────┬────────┘
         │ (5min)
         ↓
┌─────────────────┐
│   Cassandra     │
│ measurements_by_sensor_day
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌─────────┐ ┌──────────────┐
│ Java    │ │  Python AI   │
│ Analytics│ │  Service     │
│ Service  │ │  (FastAPI)   │
└─────────┘ └──────────────┘
              │
              ├─→ Random Forest (court terme)
              ├─→ LSTM (long terme, optionnel)
              └─→ Anomaly Detection (ML)
```

## Points d'API

- `POST /api/v1/forecasts/predict` : Prévision Random Forest (24h d'historique requis)
- `POST /api/v1/lstm-forecasts/predict` : Prévision LSTM (168h d'historique requis, optionnel)
- `POST /api/v1/anomalies/detect` : Détection d'anomalies par ML

## Configuration Docker

Le service AI est configuré dans `docker-compose.yml` avec :
- `CASSANDRA_HOST=cassandra` (nom du service Docker)
- Dépendance sur `cassandra` avec healthcheck
- Port 8085 exposé

En développement local, utiliser `CASSANDRA_HOST=localhost` via `.env` ou variables d'environnement.
