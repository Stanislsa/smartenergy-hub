# Simulateur de capteurs : envoi de mesures au Collector (partie D)

`send-measurements.mjs` est le **simulateur officiel** du projet (sujet, Étape 2).

`send-measurements.mjs` envoie des mesures à `POST /api/measurements` (Collector, 8081) pour les
**capteurs actifs de MongoDB** (lus via `GET /api/sensors`, Analytics 8083). Les mesures suivent la
vraie chaîne : Collector → Redis Streams → Storage → Cassandra → Analytics → front.

Il sert à :
- simuler plusieurs capteurs qui envoient des mesures au Collector (Étape 2) ;
- alimenter le front avec des mesures en continu ;
- l'expérience de charge du monitoring (Étape 11) : débit, codes HTTP et latences du Collector.

Prérequis : Node.js 18 ou plus, Collector et Analytics démarrés (Storage pour l'écriture dans Cassandra).

## Utilisation (depuis la racine du dépôt)

```cmd
:: alimentation continue : 1 mesure/s, réparties sur les capteurs actifs (Ctrl+C pour arrêter)
node scripts/load/send-measurements.mjs

:: expérience de charge : 20 mesures/s pendant 60 s
node scripts/load/send-measurements.mjs --rate 20 --duration 60

:: avec 1 % de pics (puissance > maxPowerKw), pour voir des anomalies dans le front
node scripts/load/send-measurements.mjs --spike 0.01

:: test du sujet (§10.2) : 5 capteurs pendant 2 minutes, une mesure toutes les 5 s par capteur, 5 % de pics ;
:: le bilan compare les envois au compteur du Collector
node scripts/load/send-measurements.mjs --sensors 5 --rate 1 --duration 120 --spike 0.05

:: historique des 24 dernières heures (1 mesure / 5 min par capteur, envoyé au Collector), puis arrêt
:: nécessaire pour la prévision de ai-service, qui lit les 24 dernières heures dans Cassandra
node scripts/load/send-measurements.mjs --backfill-hours 24
```

| Option | Rôle | Défaut |
|---|---|---|
| `--rate` | mesures par seconde (toutes capteurs confondus, max 500) | 1 |
| `--duration` | durée en secondes | sans fin |
| `--spike` | proportion de mesures en pic (0 à 1) | 0 |
| `--sensors` | nombre de capteurs simulés (1 à 100) : capteurs actifs de MongoDB, complétés par SIM-001, SIM-002… (absents de MongoDB : leurs mesures sont stockées mais l'Analytics ne les connaît pas) | capteurs actifs de MongoDB |
| `--backfill-hours` | envoie l'historique des N dernières heures (max 168), à 50 mesures/s, puis s'arrête | — |
| `--collector` | URL du Collector | `http://localhost:8081` |
| `--analytics` | URL de l'Analytics (liste des capteurs) | `http://localhost:8083` |

## Valeurs envoyées

Règle de génération du sujet (§10.1) : P(t) = Pbase + A·sin(2πt/T) + ε(t), avec (fichier `profile.mjs`) :

| Paramètre du sujet | Valeur |
|---|---|
| Pbase (consommation moyenne) | 45 % du `maxPowerKw` du capteur |
| A (amplitude) | 30 % de Pbase |
| T (période) | 24 h (minimum vers 3 h UTC, maximum vers 15 h UTC) |
| ε (bruit) | aléatoire, ± 5 % de Pbase |

Horodatage = instant d'envoi (UTC). Tension 230 V ± 3 ; courant calculé par I = P / U ; fréquence 50 Hz ± 0,05 ;
température 26 °C ± 1,5.

Scénario d'anomalie (`--spike`) : la puissance passe entre 1,2 et 1,6 × `maxPowerKw`, soit environ 2,7 à 3,6 fois
la consommation moyenne (le sujet propose « une puissance multipliée par trois »). Ces mesures restent valides pour
le Collector et sont signalées comme anomalies par l'Analytics.

## Sortie

Toutes les 10 s : nombre de mesures envoyées, réponses 202, latence moyenne et p95.
À la fin (ou Ctrl+C) : bilan avec codes HTTP, mesures acceptées par capteur, latences p50, p95, p99, max, et
comparaison avec le nombre de mesures reçues par le Collector (compteur Actuator `energy.measurements`).

Exemple d'exécution : voir `docs/tests.md`, test S1.

## Jeu de données d'entraînement pour ai-service

`generate-training-data.mjs` produit le CSV attendu par `ai-service/training/train_forecast_model.py`
(`sensor_id, measured_at, power_kw, voltage, temperature`, plus `current, frequency, is_anomaly, anomaly_type`),
avec le **même profil** que `send-measurements.mjs` (fichier commun `profile.mjs`) et les identifiants des
capteurs de MongoDB.

```cmd
:: 90 jours, une mesure toutes les 5 min, capteurs lus dans MongoDB, sortie ai-service/data/raw/
node scripts/load/generate-training-data.mjs
:: avec une copie JSON
node scripts/load/generate-training-data.mjs --json
```

Options : `--days` (90), `--step` en minutes (5), `--spike` (0.02), `--voltage-drop` (0.01), `--out`
(`ai-service/data/raw`), `--json`, `--sensors ID:maxPowerKw,...` (si l'Analytics n'est pas lancé).
Les fichiers générés ne sont pas destinés à être versionnés.
