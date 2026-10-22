# Scripts d'Entraînement ML

Ce dossier contient les scripts pour l'entraînement et l'évaluation des modèles ML.

## Scripts

### 1. build_dataset.py
Récupère les données historiques de Cassandra et les prépare pour l'entraînement.

**Usage:**
```bash
python training/build_dataset.py
```

**Fonctionnalités:**
- Connexion à Cassandra
- Récupération des mesures
- Validation de la qualité des données
- Sauvegarde en CSV

**Sortie:** `data/raw/dataset.csv`

### 2. train_anomaly_model.py
Entraîne un modèle Isolation Forest pour la détection d'anomalies.

**Prérequis:**
- Dataset généré par `build_dataset.py`

**Usage:**
```bash
python training/train_anomaly_model.py
```

**Fonctionnalités:**
- Chargement du dataset
- Prétraitement (imputation, normalisation)
- Entraînement Isolation Forest
- Sauvegarde du modèle et du scaler

**Sortie:**
- `artifacts/anomaly_detector/model_v{timestamp}.joblib`
- `artifacts/anomaly_detector/scaler_v{timestamp}.joblib`
- `artifacts/anomaly_detector/metadata.json`

### 3. evaluate_model.py
Évalue les performances du modèle entraîné.

**Prérequis:**
- Modèle entraîné par `train_anomaly_model.py`

**Usage:**
```bash
python training/evaluate_model.py
```

**Fonctionnalités:**
- Chargement du modèle
- Évaluation sur données de test
- Génération de rapport

**Sortie:** `artifacts/anomaly_detector/evaluation_report.json`

## Flux de Travail

1. **Récupérer les données:**
   ```bash
   python training/build_dataset.py
   ```

2. **Entraîner le modèle:**
   ```bash
   python training/train_anomaly_model.py
   ```

3. **Évaluer le modèle:**
   ```bash
   python training/evaluate_model.py
   ```

## Configuration

Les paramètres peuvent être ajustés dans les scripts :
- `contamination`: Proportion attendue d'anomalies (défaut: 0.1)
- `test_size`: Proportion de données de test (défaut: 0.2)
- `n_estimators`: Nombre d'arbres dans Isolation Forest (défaut: 100)

## Notes

- Les scripts sont actuellement en mode "squelette" - la connexion Cassandra doit être implémentée
- L'entraînement ne peut pas être lancé tant que le dataset n'est pas disponible
- Les modèles sont versionnés avec timestamp
- Le scaler est sauvegardé pour être utilisé en production
