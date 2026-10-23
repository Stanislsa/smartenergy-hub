# Monitoring — Étape 11 (partie D)

## 1. Actuator par service

| Service | Actuator | Endpoints exposés | Remarque |
|---|---|---|---|
| collector-service (8081) | ✅ | `health`, `info`, `metrics` | déjà présent (partie A) |
| analytics-service (8083) | ✅ | `health` (détaillé), `info`, `metrics` | ajouté par la partie D |
| storage-service (8082) | ❌ | — | à ajouter par la partie B (même configuration) |

Configuration ajoutée dans `analytics-service` :

```properties
management.endpoints.web.exposure.include=health,info,metrics
management.endpoint.health.show-details=always
```

`/actuator/health` de l'Analytics détaille l'état de **MongoDB**, **Cassandra** et **Redis** (indicateurs
fournis par Spring Boot pour les starters déjà utilisés par le service).

Vérification :

```cmd
curl http://localhost:8083/actuator/health
curl http://localhost:8083/actuator/metrics
curl http://localhost:8081/actuator/metrics/http.server.requests?tag=uri:/api/measurements
```

## 2. Métriques suivies

| # | Métrique | Source | Ce qu'elle montre |
|---|---|---|---|
| 1 | Latence et nombre de requêtes de `POST /api/measurements` | `http.server.requests` (Actuator du Collector) + latence mesurée par le client | capacité du Collector à accepter le débit |
| 2 | `lag` et `pending` du groupe `storage-group` | `XINFO GROUPS energy-measurements` (Redis) | le Storage suit-il le débit ? messages en retard ou non acquittés |
| 3 | `process.cpu.usage` et `jvm.memory.used` | Actuator du Collector et de l'Analytics | consommation des ressources sous charge |

Le Storage n'expose pas encore Actuator : son comportement est observé par la métrique 2
(retard du groupe de consommateurs dans Redis).

## 3. Expérience de charge

Outil : `scripts/load/load-test.mjs` (Node.js 18 ou plus). Pour chaque palier de débit, le script envoie des
mesures au Collector pour les capteurs actifs de MongoDB, relève les métriques toutes les 5 s, puis attend que
le Storage ait rattrapé le flux (lag = 0).

```cmd
:: depuis la racine du dépôt, bases Docker + Storage + Collector + Analytics lancés
node scripts/load/load-test.mjs --steps 5,20,50,100 --duration 30
```

Le rapport est écrit dans `docs/monitoring-resultats.md`.

## 4. Résultats (24/10/2026)

Conditions : PC Windows 10, 2 cœurs alloués à Docker ; MongoDB, Redis, Cassandra dans Docker ; Storage, Collector et
Analytics lancés avec Maven (`-Xmx384m`, `-Xmx256m`, `-Xmx384m`) ; 2 capteurs actifs (SENSOR-001, SENSOR-002) ;
4 paliers de 30 s. Commande : `node scripts/load/load-test.mjs --steps 5,20,50,100 --duration 30`.

### Collector et flux Redis

| Débit visé | Mesures envoyées | Acceptées (202) | Latence moy. (ms) | p95 (ms) | Max (ms) | Requêtes vues par Actuator | Temps serveur moy. (ms) | Lag Redis max | Lag en fin d'envoi | Rattrapage du Storage |
|---|---|---|---|---|---|---|---|---|---|---|
| 5/s | 150 | 150 | 18,2 | 53,4 | 459,4 | 150 | 14,19 | 4 | 0 | 0,6 s |
| 20/s | 600 | 600 | 26,6 | 71,8 | 831,3 | 600 | 22,43 | 48 | 0 | 0,9 s |
| 50/s | 1 500 | 1 500 | 20,5 | 60,7 | 517,4 | 1 500 | 16,55 | 106 | 0 | 0,3 s |
| 100/s | 3 000 | 3 000 | 13,8 | 41,0 | 276,4 | 3 000 | 10,93 | 261 | 0 | 0,4 s |

Toutes les mesures prévues (débit × 30 s) ont été envoyées et acceptées. La colonne « Débit obtenu » du rapport brut
(`docs/monitoring-resultats.md` : 4,4 / 17,2 / 43,1 / 88,0 par seconde) était sous-estimée : elle divisait par la durée
incluant l'attente du dernier relevé (≈ 34 s au lieu de 30 s). Le calcul est corrigé dans `load-test.mjs`.

### JVM (maximum relevé pendant l'envoi)

| Débit visé | CPU Collector (%) | Mémoire Collector (Mo) | CPU Analytics (%) | Mémoire Analytics (Mo) |
|---|---|---|---|---|
| 5/s | 28,9 | 101 | 0,6 | 126 |
| 20/s | 3,2 | 107 | 0,7 | 127 |
| 50/s | 4,3 | 119 | 0,5 | 127 |
| 100/s | 7,5 | 141 | 0,6 | 128 |

## 5. Analyse

1. **Aucune perte ni refus jusqu'à 100 mesures/s** : 5 250 mesures envoyées, 5 250 réponses 202, et le nombre de requêtes
   compté par Actuator côté Collector est identique à celui du client.
2. **Le Storage suit le débit.** Le lag du groupe `storage-group` monte pendant l'envoi (jusqu'à 261 messages à 100/s,
   relevé toutes les 5 s) mais il est revenu à 0 dès la fin de chaque palier (rattrapage en moins de 1 s). Le Storage
   traite donc au moins 100 mesures/s sur ce poste ; sa limite n'a pas été atteinte.
3. **Latence stable, voire en baisse avec la charge** : moyenne entre 14 et 27 ms, p95 entre 41 et 72 ms. La baisse
   au dernier palier s'explique par le préchauffage de la JVM (compilation JIT) au fil des paliers. Les maximums
   (276 à 831 ms) sont des pics isolés (p95 < 72 ms), probablement liés au ramasse-miettes ou au poste Windows.
4. **Premier palier : CPU du Collector à 28,9 %** puis 3 à 8 % ensuite : coût du démarrage à froid (premières requêtes),
   déjà observé avec `send-measurements.mjs` (p95 de 555 ms dans les 10 premières secondes).
5. **Mémoire du Collector** : de 101 à 141 Mo, sous la limite de 256 Mo fixée par `-Xmx256m`.
6. **L'Analytics n'est pas sur le chemin d'écriture** : CPU < 1 % et mémoire stable (≈ 127 Mo) pendant toute
   l'expérience, ce qui est attendu (il ne lit que sur demande).

**Limites de l'expérience**
- Débit maximal testé : 100 mesures/s ; la saturation n'a pas été atteinte. Paliers suivants possibles :
  `--steps 200,300,500`.
- Le Storage n'expose pas Actuator : son CPU et sa mémoire ne sont pas mesurés ; son comportement est déduit du lag Redis.
- Un seul poste, services et bases sur la même machine : les chiffres dépendent du matériel.
- Paliers courts (30 s) : pas d'observation de la tenue sur la durée.
