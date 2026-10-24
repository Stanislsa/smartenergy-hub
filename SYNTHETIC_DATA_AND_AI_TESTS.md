# SmartEnergy Hub — Préparation des données synthétiques et validation de l'IA

## Étape 1 - Audit en lecture seule (24/10/2026)

### Routes backend réelles

#### Collector Service (port 8081)
- `POST /api/measurements` - Envoie une mesure dans Redis Stream

#### Storage Service (port 8082)
- `GET /` - Home
- `GET /health` - Health
- `POST /api/cassandra/test/write` - Test écriture (endpoint de test)
- `GET /api/cassandra/test/read/{sensorId}` - Test lecture par jour (endpoint de test)
- `GET /api/cassandra/test/latest/{sensorId}` - Test lecture dernières mesures (endpoint de test)
- **PAS de `/api/measurements/{sensorId}/latest`** (endpoint de production)

#### Analytics Service (port 8083)
- `GET /api/measurements/{sensorId}` - Historique des mesures
- `GET /api/measurements/{sensorId}/latest` - Dernière mesure
- `GET /api/sensors` - Liste des capteurs
- `POST /api/sensors` - Créer un capteur
- `GET /api/sensors/{sensorId}` - Détail d'un capteur
- `PUT /api/sensors/{sensorId}` - Modifier un capteur
- `GET /api/sensors/{sensorId}/daily-summary` - Résumé quotidien
- `POST /api/sensors/{sensorId}/daily-summary/compute` - Calculer le résumé quotidien
- `GET /api/analytics/{sensorId}/summary` - Indicateurs descriptifs
- `GET /api/analytics/{sensorId}/anomalies` - Anomalies (méthodes seuil + z-score)
- `GET /api/analytics/{sensorId}/anomalies/all` - Toutes les anomalies (complet)

#### AI Service (port 8085)
- `POST /api/v1/forecasts/predict` - Prédiction de consommation
- `GET /api/v1/model/status` - Statut du modèle

### Configuration proxy Vite

```javascript
// vite.config.js
'/api' → analytics-service (8083)
'/ai' → ai-service (8085) avec rewrite '/ai' → ''
```

**Conséquence** : Le frontend appelle `/api/measurements/...` qui est routé vers analytics-service, PAS vers storage-service.

### Données existantes

#### MongoDB (smartenergy)
**Capteurs :**
- SENSOR-001 : Compteur salle serveur (Bâtiment A, actif, maxPowerKw=8)
- SENSOR-002 : Compteur atelier (Bâtiment B, actif, maxPowerKw=12)
- SENSOR-003 : Compteur bureaux (Bâtiment A, inactif, maxPowerKw=5)

**Résumés quotidiens :**
- SENSOR-001 : date=2026-09-30, avgPowerKw=3.42, maxPowerKw=7.81, energyKwh=68.2, anomalyCount=2

#### Cassandra (smartenergy.measurements_by_sensor_day)
**Mesures de test :**
- TEST-SENSOR-001 : 2 mesures du 2026-10-21
- SENSOR-TEST-002 : 1 mesure du 2026-10-21

**Note** : Aucune mesure pour SENSOR-001, SENSOR-002, SENSOR-003 dans les 7 derniers jours.

### Analyse des erreurs frontend

#### 1. 404 sur `/api/measurements/{sensorId}/latest`

**Cause identifiée :**
- L'endpoint existe dans analytics-service (MeasurementController.java ligne 41-45)
- Le service `MeasurementQueryService.latest()` vérifie que le capteur existe dans MongoDB ✓
- Il cherche ensuite des mesures dans Cassandra sur les 7 derniers jours (LATEST_LOOKBACK_DAYS = 7)
- **Problème** : Les capteurs SENSOR-001, SENSOR-002, SENSOR-003 n'ont AUCUNE mesure dans Cassandra
- Les seules mesures dans Cassandra sont pour TEST-SENSOR-001 et SENSOR-TEST-002 (données de test du 2026-10-21)

**Code concerné :**
```java
// MeasurementQueryService.java ligne 69-81
public MeasurementResponse latest(String sensorId) {
    sensorService.requireExists(sensorId);
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    for (int i = 0; i < LATEST_LOOKBACK_DAYS; i++) {
        List<MeasurementRecord> rows = repository.findLatestInPartition(sensorId, today.minusDays(i));
        if (!rows.isEmpty()) {
            return MeasurementResponse.from(rows.get(0));
        }
    }
    throw new ResourceNotFoundException("Aucune mesure sur les 7 derniers jours pour " + sensorId);
}
```

#### 2. 404 sur `/api/sensors/{sensorId}/daily-summary`

**Cause identifiée :**
- L'endpoint existe dans SensorController.java (ligne 76-83)
- Le service `DailySummaryService.get(sensorId, date)` retourne une erreur 404 si pas de résumé trouvé
- **Problème** : Il y a un résumé pour SENSOR-001 mais pour la date 2026-09-30
- Le frontend demande probablement la date du jour (2026-10-24) qui n'existe pas dans MongoDB

**Code concerné :**
```java
// SensorController.java ligne 76-83
@GetMapping("/{sensorId}/daily-summary")
public DailySummaryResponse dailySummary(
        @PathVariable String sensorId,
        @RequestParam(required = false) LocalDate date) {
    return summaryService.get(sensorId, date);
}
```

#### 3. 422 sur `/ai/api/v1/forecasts/predict`

**Cause identifiée :**
- Le frontend envoie `{ sensor_id: "SENSOR-001", horizon_minutes: 60 }`
- Le schéma `ForecastRequest` attend `sensor_id` et `horizon_minutes` (snake_case) ✓
- Le service IA appelle `forecast_service.get_features_from_cassandra(request.sensor_id)`
- **Problème** : Pas de données dans Cassandra pour SENSOR-001
- Le service IA lève une `ValueError` qui est convertie en HTTP 422 (forecasts.py ligne 36-37)

**Code concerné :**
```python
# forecasts.py ligne 20-24
features = forecast_service.get_features_from_cassandra(request.sensor_id)
prediction = forecast_service.predict(features, request.horizon_minutes, sensor_id=request.sensor_id)
```

```python
# forecasts.py ligne 36-37
except ValueError as e:
    raise HTTPException(status_code=422, detail=str(e))
```

#### 4. 500 sur endpoint de mesure

**Cause identifiée :**
- Probablement lié à une erreur interne dans `MeasurementQueryService` ou `MeasurementRecordRepository`
- Peut être dû à une incohérence dans les données Cassandra ou un problème de connexion

### Schéma des mesures

#### EnergyMeasurementRequest (Collector)
```java
// collector-service/dto/EnergyMeasurementRequest.java
sensorId: String (required)
timestamp: Instant (required)
powerKw: double (required)
voltage: double (required)
current: Double (optional)
frequency: Double (optional)
temperature: Double (optional)
```

#### MeasurementEntity (Cassandra)
```java
// storage-service/entity/MeasurementEntity.java
key: MeasurementKey {
    sensorId: String
    day: LocalDate
    measuredAt: Instant
}
powerKw: double
voltage: double
current: Double
frequency: Double
temperature: Double
recordId: UUID
```

#### ForecastRequest (AI Service)
```python
# ai-service/app/schemas/prediction.py
sensor_id: str (required)
horizon_minutes: int (default=60, min=1, max=1440)
```

### Conclusions de l'audit

1. **Les routes API sont correctement déclarées** dans les backends
2. **Le proxy Vite est correctement configuré** pour router vers analytics-service
3. **Les erreurs 404 sont dues à l'absence de données** dans Cassandra pour les capteurs SENSOR-001, SENSOR-002, SENSOR-003
4. **L'erreur 422 est due à l'absence de données** dans Cassandra pour le service IA
5. **Les données de test existantes dans Cassandra** (TEST-SENSOR-001, SENSOR-TEST-002) ne correspondent pas aux capteurs MongoDB
6. **Aucun modèle IA n'est entraîné** pour les capteurs réels (SENSOR-001, SENSOR-002, SENSOR-003)

---

## Étape 2 - Corrections API nécessaires

### Corrections à apporter

#### 2.1 Corriger l'incohérence des données de test

**Problème** : Les données de test dans Cassandra utilisent des IDs (TEST-SENSOR-001, SENSOR-TEST-002) qui n'existent pas dans MongoDB.

**Solution** : Soit supprimer ces données de test, soit créer les capteurs correspondants dans MongoDB.

#### 2.2 Générer des données synthétiques pour les capteurs existants

**Action requise** : Générer des mesures dans Cassandra pour SENSOR-001, SENSOR-002, SENSOR-003 sur une période récente (7 derniers jours minimum).

#### 2.3 Calculer les résumés quotidiens

**Action requise** : Appeler `POST /api/sensors/{sensorId}/daily-summary/compute` pour chaque capteur et chaque jour avec des données.

#### 2.4 Entraîner ou charger les modèles IA

**Action requise** : Vérifier si des modèles existent pour les capteurs, sinon les entraîner avec les données synthétiques.

---

## Étape 3 - Générateur de données synthétiques

### Spécifications

Le générateur doit :
1. **Être reproductible** grâce à une graine aléatoire configurable
2. **Permettre de choisir** le nombre de capteurs et la période
3. **Produire des séries temporelles ordonnées** par timestamp
4. **Générer différents profils** :
   - Normal : consommation typique
   - Pics : consommation élevée (proche de maxPowerKw)
   - Valeurs aberrantes : dépassement de maxPowerKw
   - Interruptions : consommation nulle ou très faible
5. **Respecter les contrats** :
   - Champs : sensorId, timestamp, powerKw, voltage, current, frequency, temperature
   - Types : String, Instant, double, double, Double, Double, Double
   - Horodatages : ISO 8601 UTC
6. **Utiliser les IDs existants** : SENSOR-001, SENSOR-002, SENSOR-003
7. **Permettre un volume réduit** pour tests rapides et un volume important pour tests de charge

### Implémentation

À créer : `scripts/generate_synthetic_data.py`

---

## Étape 4 - Injection et vérification des données

### Pipeline réel

```
Simulateur → Collector (POST /api/measurements) → Redis Stream → Storage (consumer) → Cassandra → Analytics → API → Frontend
```

### Étapes de vérification

1. **Vérifier Redis Stream** : Confirmer que les messages sont publiés
2. **Vérifier Cassandra** : Confirmer que les mesures sont persistées
3. **Vérifier Analytics** : Confirmer que les endpoints de lecture fonctionnent
4. **Calculer les résumés** : Appeler l'endpoint de calcul
5. **Vérifier l'IA** : Confirmer que les prévisions fonctionnent

---

## Étape 5 - Tests de l'IA

### Vérifications à effectuer

1. **Démarrage du service IA** : Vérifier que le service démarre sans erreur
2. **Endpoint de santé** : `GET /ai/api/v1/model/status`
3. **Schéma d'entrée** : Vérifier que le JSON envoyé respecte ForecastRequest
4. **Prédiction** : Vérifier que la prédiction retourne une réponse valide
5. **Sorties** : Vérifier que les sorties sont finies, cohérentes et correctement formatées
6. **Gestion des erreurs** : Vérifier que les erreurs de validation sont gérées proprement

### État actuel des modèles IA

À vérifier : Existe-t-il des modèles entraînés pour SENSOR-001, SENSOR-002, SENSOR-003 ?

---

## Étape 6 - Évaluation des résultats

### Tests fonctionnels

- Le pipeline de bout en bout fonctionne
- Les données sont correctement persistées
- Les endpoints API retournent les résultats attendus
- L'IA génère des prévisions cohérentes

### Tests de qualité du modèle

À définir après génération des données synthétiques.

---

## Livrables

- [ ] Rapport `SYNTHETIC_DATA_AND_AI_TESTS.md` (ce document)
- [ ] Script de génération `scripts/generate_synthetic_data.py`
- [ ] Instructions de lancement et de nettoyage
- [ ] Corrections API effectuées
- [ ] Tests exécutés et résultats
- [ ] Limites connues du modèle et du jeu de données
