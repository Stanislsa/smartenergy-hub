# Résultats de l'expérience de charge

Généré par `scripts/load/load-test.mjs` le 2026-10-28T22:14:31.143Z.
Capteurs : SENSOR-001, SENSOR-002. Durée par palier : 30 s.

## Collector et flux Redis

| Débit visé | Débit obtenu | Acceptées (202) | Latence moy. (ms) | p95 (ms) | Max (ms) | Requêtes vues par Actuator | Temps serveur moy. (ms) | Lag Redis max | Lag en fin d'envoi | Rattrapage du Storage |
|---|---|---|---|---|---|---|---|---|---|---|
| 5/s | 5.0/s | 150 / 150 | 31.9 | 50.6 | 930.0 | — | — | 4 | 0 | 0.3 s |
| 20/s | 20.0/s | 600 / 600 | 25.9 | 28.7 | 943.5 | 600 | 22.62 | 25 | 0 | 0.3 s |
| 50/s | 50.0/s | 1500 / 1500 | 9.0 | 19.4 | 103.6 | 1500 | 6.39 | 106 | 0 | 0.3 s |
| 100/s | 100.0/s | 3000 / 3000 | 8.8 | 20.5 | 58.4 | 3000 | 6.20 | 1183 | 1022 | 15.2 s |

## Métriques métier du Collector (Micrometer)

| Débit visé | Envoyées | `energy.measurements` accepted | Publication Redis moy. (ms) | Publication Redis max (ms) |
|---|---|---|---|---|
| 5/s | 150 | 150 | 19.22 | 639.79 |
| 20/s | 600 | 600 | 18.91 | 938.93 |
| 50/s | 1500 | 1500 | 3.54 | 938.93 |
| 100/s | 3000 | 3000 | 3.28 | 938.93 |

## JVM (maximum relevé pendant l'envoi)

| Débit visé | CPU Collector (%) | Mémoire Collector (Mo) | CPU Analytics (%) | Mémoire Analytics (Mo) |
|---|---|---|---|---|
| 5/s | 14.3 | 103 | 0.9 | 130 |
| 20/s | 5.2 | 107 | 0.7 | 130 |
| 50/s | 6.4 | 111 | 0.9 | 132 |
| 100/s | 11.1 | 112 | 1.0 | 133 |

Codes HTTP par palier : 5/s → {"202":150} ; 20/s → {"202":600} ; 50/s → {"202":1500} ; 100/s → {"202":3000}
