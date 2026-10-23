# Module Analytics — Étape 9 (partie D)

Ce document décrit les calculs du module Analytics (`analytics-service`), niveaux A et B du sujet.

## Emplacement du code

| Fichier | Rôle |
|---|---|
| `analytics/model/MeasurementPoint.java` | Mesure minimale (horodatage UTC + puissance en kW), indépendante de Cassandra |
| `analytics/calculator/EnergyCalculator.java` | Niveau A : analyse descriptive |
| `analytics/calculator/EnergyStatistics.java` | Résultat du niveau A |
| `analytics/calculator/AnomalyDetector.java` | Niveau B : détection d'anomalies (seuil + z-score) |
| `analytics/calculator/Anomaly.java`, `AnomalyType.java` | Anomalie détectée et méthode utilisée |

Les calculs ne lisent aucune base : ils reçoivent une liste de mesures. La lecture Cassandra
(partie B) et le seuil `maxPowerKw` du capteur (MongoDB, partie C) seront branchés ensuite.

## Niveau A — Analyse descriptive

Indicateurs calculés pour un capteur sur une période :

- nombre de mesures reçues ;
- puissance moyenne, minimale et maximale (kW) ;
- énergie estimée (kWh) ;
- nombre de dépassements d'un seuil (mesures **strictement** supérieures au seuil).

### Estimation de l'énergie

Formule du sujet : **E ≈ Σ Pᵢ·Δt** (E en kWh si P en kW et Δt en heures).

- Les mesures sont d'abord triées par horodatage (Cassandra renvoie l'ordre décroissant).
- Δt est l'intervalle **réel** entre une mesure et la suivante : les mesures ne sont pas forcément régulières.
- Chaque puissance Pᵢ est supposée constante jusqu'à la mesure suivante (rectangles à gauche).
- La dernière mesure ne contribue pas : sa durée est inconnue.

Exemple : 3 kW constants mesurés toutes les 5 minutes pendant 1 h → **3 kWh**.

**Limites :**
- si un capteur cesse d'émettre pendant longtemps, l'intervalle est compté avec la dernière puissance connue (surestimation possible) ;
- une seule mesure donne une énergie nulle.

## Niveau B — Détection d'anomalies

### Méthode 1 : seuil par capteur

**Anomalie = Pₜ > Pmax**, où Pmax est le `maxPowerKw` du capteur (MongoDB).
Une mesure égale à Pmax n'est pas une anomalie. Sans Pmax configuré, aucune anomalie de seuil.

### Méthode 2 : score standardisé (z-score)

**zₜ = (Pₜ − µ) / σ** (µ = moyenne, σ = écart-type des mesures de la période).
Une mesure est signalée si **|zₜ| > 3**.

**Justification du seuil 3 :** pour une distribution proche de la loi normale, environ 99,7 %
des valeurs vérifient |z| ≤ 3. Une valeur au-delà est rare et mérite une alerte, sans
déclencher d'alertes sur les variations normales (sinus du simulateur).

**Limites :**
- σ = 0 (puissance constante) : z n'est pas défini, aucune anomalie n'est signalée ;
- avec n mesures, |z| ≤ (n − 1)/√n : il faut **au moins 11 mesures** pour pouvoir dépasser 3 ;
- un pic très fort augmente lui-même µ et σ, ce qui peut masquer d'autres pics ;
- une dérive lente de la consommation n'est pas détectée.

## API REST (Étape 9)

Service `analytics-service`, port **8083**. Documentation Swagger : `http://localhost:8083/swagger-ui.html`.
Dates en ISO 8601 UTC (`2026-09-30T00:00:00Z`). Période analysée : [from ; to[.
Par défaut : `to` = maintenant, `from` = `to` − 24 h. Période maximale : 31 jours.

| Endpoint | Rôle |
|---|---|
| `GET /api/analytics/{sensorId}/summary?from=&to=` | Niveau A : moyenne, min, max, nombre de mesures, énergie, dépassements du `maxPowerKw` |
| `GET /api/analytics/{sensorId}/anomalies?from=&to=&z=3` | Niveau B : anomalies par seuil et par z-score |
| `GET /api/analytics/{sensorId}/anomalies/all?from=&to=&z=3&variation=50&minVoltage=210&maxVoltage=250&maxTemperature=80` | Détection étendue : les 5 méthodes ci-dessous |

| Cas | Code |
|---|---|
| Requête valide | 200 |
| `from` ≥ `to`, période > 31 jours, `z` ≤ 0, date mal formée | 400 |
| Capteur absent de MongoDB | 404 |

Exemple — `GET /api/analytics/SENSOR-001/summary?from=2026-09-30T00:00:00Z&to=2026-10-01T00:00:00Z`
(source de démonstration) :

```json
{
  "sensorId": "SENSOR-001",
  "from": "2026-09-30T00:00:00Z",
  "to": "2026-10-01T00:00:00Z",
  "measurementCount": 288,
  "avgPowerKw": 3.534,
  "minPowerKw": 1.857,
  "maxPowerKw": 13.94,
  "energyKwh": 84.647,
  "maxPowerThresholdKw": 8.0,
  "thresholdExceedances": 1
}
```

### Source des mesures

Les mesures sont lues via l'interface `MeasurementReader` :

- **`DemoMeasurementReader`** (profil `mongo-only` et tests) : données simulées reproductibles, une mesure
  toutes les 5 min, cycle jour/nuit en sinus (≈ 2 kW à minuit, ≈ 5 kW à midi), bruit ± 0,2 kW,
  **pic ×3 chaque jour à 14h00 UTC**. Utile pour les tests et les démonstrations sans base.
- **`CassandraMeasurementReader`** (**par défaut**) : lit les mesures réelles dans la table
  `smartenergy.measurements_by_sensor_day` (créée par la partie B, `scripts/init-cassandra.cql`).

| Source | Activation |
|---|---|
| Cassandra (défaut) | `analytics.measurement-source=cassandra` dans `application.properties` |
| Démo | profil `mongo-only` (automatique), ou `analytics.measurement-source=demo` |

Pour forcer la démo sans modifier `application.properties` :

```cmd
:: au lancement Maven
mvnw.cmd -pl analytics-service spring-boot:run -Dspring-boot.run.arguments=--analytics.measurement-source=demo
:: ou par variable d'environnement (Docker Compose, CMD…)
set ANALYTICS_MEASUREMENT_SOURCE=demo
```

### Lecture Cassandra

La table est partitionnée par **(sensor_id, day)**, `day` étant le jour **UTC** de la mesure,
avec `measured_at` en colonne de clustering (ordre décroissant). Pour une période [from ; to[ :

1. le lecteur calcule les jours UTC couverts (ex. 19/10 22h → 21/10 02h = 3 jours) ;
2. il envoie **une requête par partition** :
   `SELECT * FROM measurements_by_sensor_day WHERE sensor_id = ? AND day = ? AND measured_at >= ? AND measured_at < ?` ;
3. il regroupe les résultats (les calculs les trient ensuite par horodatage).

Ce modèle d'accès respecte la clé de partition : pas de `ALLOW FILTERING`, pas de parcours
de toute la table. La période étant limitée à 31 jours, on fait au plus 32 requêtes.
Les lignes sans puissance ou avec une puissance invalide sont ignorées et signalées dans les logs.
Le mapping (`MeasurementRow`, `MeasurementRowKey`) est propre à `analytics-service` et en lecture seule.

Le seuil `maxPowerKw` est lu dans MongoDB via le `SensorService` existant (partie C).

## Détection étendue (`/anomalies/all`)

Ajoutée par Stan pour tenir compte de la tension et de la température des mesures, puis corrigée et testée.

| Méthode | Règle | `score` | `limit` | `value` |
|---|---|---|---|---|
| `THRESHOLD` | P > maxPowerKw du capteur | P / Pmax | Pmax (kW) | — |
| `Z_SCORE` | \|z\| > z | z | z | — |
| `POWER_VARIATION` | \|ΔP / P(t-1)\| > variation % **et** \|ΔP\| ≥ 1 kW, hors retour à la normale | variation (%) | seuil (%) | — |
| `VOLTAGE` | tension < minVoltage ou > maxVoltage | tension (V) | borne dépassée (V) | tension (V) |
| `TEMPERATURE` | température > maxTemperature | température (°C) | maximum (°C) | température (°C) |

- **Écart minimal de 1 kW** pour les variations : sans lui, 0,1 → 0,2 kW (+100 %) serait une alerte.
- **Retour à la normale ignoré** : la mesure qui revient au niveau habituel juste après un pic
  n'est pas une seconde anomalie (un pic = une alerte).
- La tension et la température sont **facultatives** : lues dans Cassandra (colonnes `voltage`,
  `temperature`) ; absentes ou invalides, elles valent `null` et seules les méthodes de puissance s'appliquent.
- `anomalyCountByMethod` donne le nombre d'anomalies par méthode (0 compris).

Sur 24 h de démo, le pic de 14h00 est signalé par `THRESHOLD`, `Z_SCORE` et `POWER_VARIATION`
(une fois chacun) ; tension (224–236 V) et température (24–60 °C) restent dans les plages par défaut.

## Format erreur vs anomalie

Une **erreur de format** (puissance négative, horodatage absent) est rejetée dès la création
d'un `MeasurementPoint` (et en amont par le Collector avec HTTP 400). Une **anomalie énergétique**
est une mesure valide mais inhabituelle : elle est conservée et signalée.

## Tests unitaires

`analytics-service/src/test/java/com/apps/smartenergyhub/analytics/` :

| Classe | Cas couverts |
|---|---|
| `EnergyCalculatorTest` | liste vide/null, une mesure, moyenne/min/max, énergie (intervalles réguliers et irréguliers), ordre d'entrée, dépassements stricts, absence de seuil, seuil invalide |
| `ExtendedAnomalyDetectorTest` | pic signalé une fois (pas le retour), chute durable, petit écart ignoré, ordre indifférent, tension trop basse/haute avec la bonne borne, bornes incluses, température, 5 méthodes ensemble, mesures sans tension ni température |
| `AnomalyDetectorTest` | seuil strict, Pmax absent/invalide, tri, pic ×3 détecté, chute détectée, σ = 0, trop peu de mesures, limite n < 11, seuil z invalide, combinaison des deux méthodes |
| `MeasurementPointTest` | mesure valide, horodatage obligatoire, puissance négative ou NaN refusée |
| `DemoMeasurementReaderTest` | 288 mesures / 24 h, début non aligné, pic de 14h00, reproductibilité |
| `CassandraMeasurementReaderTest` | une journée = une partition, période sur 3 jours = 3 requêtes, `to` à minuit exclu, lignes invalides ignorées, tension/température lues (invalides → null), période vide |
| `AnalyticsServiceTest` | résumé et anomalies sur 24 h, détection étendue sur 24 h, décompte par méthode, capteur sans seuil, capteur inconnu, période invalide, z invalide, plage de tension invalide, période par défaut, période > 31 jours |
| `AnalyticsControllerTest` | 200 summary/anomalies/anomalies-all, paramètres par défaut, 404 capteur inconnu, 400 période invalide, 400 date mal formée |

Lancement : `./mvnw -pl analytics-service test` (Windows : `mvnw.cmd -pl analytics-service test`).
