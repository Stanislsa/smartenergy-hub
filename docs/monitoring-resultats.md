# Résultats de l'expérience de charge

Généré par `scripts/load/load-test.mjs` le 2026-10-23T23:06:39.122Z.
Capteurs : SENSOR-001, SENSOR-002. Durée par palier : 30 s.

## Collector et flux Redis

| Débit visé | Débit obtenu | Acceptées (202) | Latence moy. (ms) | p95 (ms) | Max (ms) | Requêtes vues par Actuator | Temps serveur moy. (ms) | Lag Redis max | Lag en fin d'envoi | Rattrapage du Storage |
|---|---|---|---|---|---|---|---|---|---|---|
| 5/s | 4.4/s | 150 / 150 | 18.2 | 53.4 | 459.4 | 150 | 14.19 | 4 | 0 | 0.6 s |
| 20/s | 17.2/s | 600 / 600 | 26.6 | 71.8 | 831.3 | 600 | 22.43 | 48 | 0 | 0.9 s |
| 50/s | 43.1/s | 1500 / 1500 | 20.5 | 60.7 | 517.4 | 1500 | 16.55 | 106 | 0 | 0.3 s |
| 100/s | 88.0/s | 3000 / 3000 | 13.8 | 41.0 | 276.4 | 3000 | 10.93 | 261 | 0 | 0.4 s |

## JVM (maximum relevé pendant l'envoi)

| Débit visé | CPU Collector (%) | Mémoire Collector (Mo) | CPU Analytics (%) | Mémoire Analytics (Mo) |
|---|---|---|---|---|
| 5/s | 28.9 | 101 | 0.6 | 126 |
| 20/s | 3.2 | 107 | 0.7 | 127 |
| 50/s | 4.3 | 119 | 0.5 | 127 |
| 100/s | 7.5 | 141 | 0.6 | 128 |

Codes HTTP par palier : 5/s → {"202":150} ; 20/s → {"202":600} ; 50/s → {"202":1500} ; 100/s → {"202":3000}
