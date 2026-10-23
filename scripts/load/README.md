# Envoi de mesures au Collector (partie D)

`send-measurements.mjs` envoie des mesures à `POST /api/measurements` (Collector, 8081) pour les
**capteurs actifs de MongoDB** (lus via `GET /api/sensors`, Analytics 8083). Les mesures suivent la
vraie chaîne : Collector → Redis Streams → Storage → Cassandra → Analytics → front.

Il sert à :
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
```

| Option | Rôle | Défaut |
|---|---|---|
| `--rate` | mesures par seconde (toutes capteurs confondus, max 500) | 1 |
| `--duration` | durée en secondes | sans fin |
| `--spike` | proportion de mesures en pic (0 à 1) | 0 |
| `--collector` | URL du Collector | `http://localhost:8081` |
| `--analytics` | URL de l'Analytics (liste des capteurs) | `http://localhost:8083` |

## Valeurs envoyées

Horodatage = instant d'envoi (UTC). Puissance autour de 45 % du `maxPowerKw` du capteur avec un cycle
jour/nuit (± 30 %) et un bruit de ± 5 % ; tension 230 V ± 3 ; courant calculé par I = P / U ;
fréquence 50 Hz ± 0,05 ; température 26 °C ± 1,5. En pic : puissance entre 1,2 et 1,6 × `maxPowerKw`.

## Sortie

Toutes les 10 s : nombre de mesures envoyées, réponses 202, latence moyenne et p95.
À la fin (ou Ctrl+C) : bilan avec codes HTTP et latences p50, p95, p99, max.
