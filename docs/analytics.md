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

## Format erreur vs anomalie

Une **erreur de format** (puissance négative, horodatage absent) est rejetée dès la création
d'un `MeasurementPoint` (et en amont par le Collector avec HTTP 400). Une **anomalie énergétique**
est une mesure valide mais inhabituelle : elle est conservée et signalée.

## Tests unitaires

`analytics-service/src/test/java/com/apps/smartenergyhub/analytics/` — 24 tests :

| Classe | Cas couverts |
|---|---|
| `EnergyCalculatorTest` | liste vide/null, une mesure, moyenne/min/max, énergie (intervalles réguliers et irréguliers), ordre d'entrée, dépassements stricts, absence de seuil, seuil invalide |
| `AnomalyDetectorTest` | seuil strict, Pmax absent/invalide, tri, pic ×3 détecté, chute détectée, σ = 0, trop peu de mesures, limite n < 11, seuil z invalide, combinaison des deux méthodes |
| `MeasurementPointTest` | mesure valide, horodatage obligatoire, puissance négative ou NaN refusée |

Lancement : `./mvnw -pl analytics-service test` (Windows : `mvnw.cmd -pl analytics-service test`).
