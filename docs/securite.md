# Note de sécurité — Étape 12

État au 29/10/2026, branche `develop`. Cette note répond au livrable de l'Étape 12 du sujet : secrets à protéger,
accès exposés et mécanismes mis en place. Le projet tourne en environnement de développement local ; les points
« production » sont signalés comme recommandations.

## 1. Niveau minimal demandé par le sujet

| Exigence (Étape 12) | État | Détail |
|---|---|---|
| Ne pas exposer de mots de passe dans Git | ✅ | Aucun mot de passe, jeton ou clé trouvé dans le code, la configuration ni l'**historique Git complet** (recherche du 29/10 sur toutes les branches) |
| Utiliser des variables d'environnement | ✅ | Hôtes et ports des bases surchargés par variables d'environnement dans `docker-compose.yml` (`SPRING_DATA_MONGODB_HOST`, `SPRING_DATA_REDIS_HOST`, `SPRING_CASSANDRA_CONTACT_POINTS`…) ; ai-service : `CASSANDRA_HOST`, `CASSANDRA_USERNAME`, `CASSANDRA_PASSWORD` lus depuis l'environnement ou `.env` |
| Valider les entrées | ✅ | Voir section 4 |
| Ne pas exposer inutilement les ports des bases en production | ⚠️ | Ports des bases publiés sur l'hôte (27018, 6380, 9042) : utile en développement, à retirer en production (section 5) |
| Définir des profils de configuration | ⚠️ | Profils Docker Compose `ai` et `all` ; profil Spring `mongo-only` (analytics-service, sans Cassandra). Pas de profil Spring `dev` / `prod` distinct |

## 2. Secrets à protéger

En local, MongoDB, Redis et Cassandra tournent **sans authentification** : il n'existe donc aucun secret réel à ce
jour, et aucun n'est commité. Les éléments à protéger dès qu'on sort du poste de développement :

| Secret | Où il serait utilisé | Règle |
|---|---|---|
| Identifiants MongoDB | analytics-service, storage-service | variable d'environnement, jamais dans `application.properties` |
| Mot de passe Redis | collector-service, storage-service, analytics-service | variable d'environnement |
| Identifiants Cassandra | storage-service, analytics-service, ai-service (`CASSANDRA_USERNAME` / `CASSANDRA_PASSWORD`, déjà prévus) | variable d'environnement ou `.env` non versionné |
| Clés ou jetons d'API (si authentification ajoutée) | tous les services exposés | coffre de secrets ou variables d'environnement |

Protection en place : `.env` et `.env.local` sont ignorés par Git (`.gitignore` racine et `frontend/.gitignore`) ;
seuls des fichiers d'exemple sans valeur sont versionnés (`ai-service/.env.example`, `frontend/.env.example`).

## 3. Accès exposés

### Ports publiés par `docker-compose.yml`

| Port hôte | Composant | Exposition nécessaire ? |
|---|---|---|
| 8081 | collector-service | oui (point d'entrée des mesures) |
| 8083 | analytics-service | oui (API de consultation, front) |
| 8082 | storage-service | non pour les utilisateurs (consomme Redis) ; utile au diagnostic |
| 8085 | ai-service | oui si le front affiche la prévision |
| 27018 | MongoDB | **non en production** |
| 6380 | Redis | **non en production** |
| 9042 | Cassandra | **non en production** |
| 5173 | front (Vite, développement) | développement uniquement |

### Endpoints sensibles (aucun n'est authentifié aujourd'hui)

| Endpoint | Risque |
|---|---|
| `POST /api/measurements` (collector) | injection de fausses mesures ou saturation (pas de limite de débit) |
| `POST /api/sensors`, `PUT /api/sensors/{id}` (analytics) | création ou modification des capteurs et de leur `maxPowerKw` (fausse les dépassements) |
| `POST /api/sensors/{id}/daily-summary/compute` (analytics) | recalcul et réécriture des résumés MongoDB |
| `POST /api/cassandra/test/write` (storage) | écrit une mesure de test dans Cassandra : endpoint de test à retirer ou désactiver hors développement |
| `/api/v1/*` (ai-service) | prévisions et alertes ; coûteux en calcul |
| `/actuator/health`, `/actuator/metrics`, `/actuator/info` (collector, analytics) | lecture seule, mais l'Analytics détaille l'état de MongoDB, Cassandra et Redis (`show-details=always`) |
| `/swagger-ui`, `/v3/api-docs` (3 services Java) | décrivent toute l'API |

## 4. Mécanismes en place

| Mécanisme | Où | Effet |
|---|---|---|
| Validation Jakarta du DTO de mesure | collector-service (`EnergyMeasurementRequest`) | `sensorId` non vide, `timestamp` et `powerKw` obligatoires, valeurs ≥ 0, fréquence > 0 ; sinon HTTP 400 détaillé (`docs/tests.md` n° 2) |
| Rejet des JSON mal formés | collector-service (`GlobalExceptionHandler`) | HTTP 400 ; compteurs `energy.measurements` `rejected_validation` / `rejected_format` |
| Validation des capteurs | analytics-service (`@Valid SensorRequest`) | `sensorId` au format `[A-Za-z0-9_-]{3,50}`, `name` et `building` obligatoires, `maxPowerKw` > 0 |
| Bornes des requêtes de lecture | analytics-service | période ≤ 31 jours, `from` < `to`, `limit` entre 1 et 5 000, seuil z > 0 : limite les lectures massives |
| Validation Pydantic | ai-service | `horizon_minutes` entre 1 et 1 440, `power_kw` > 0, `voltage` ≥ 0 |
| Messages invalides écartés | storage-service (`RedisStreamConsumer`) | un message illisible est acquitté et journalisé, pas relu en boucle |
| Requêtes Cassandra paramétrées | storage, analytics, ai-service | pas de concaténation de valeurs dans le CQL |
| Exposition Actuator limitée | collector, analytics | seulement `health`, `info`, `metrics` (pas `env`, `beans`, `heapdump`…) |
| Front sans appel direct aux bases | frontend | passe par le proxy Vite vers les API ; aucune donnée sensible stockée dans le navigateur |

## 5. Risques identifiés et recommandations

| # | Constat | Recommandation |
|---|---|---|
| 1 | Aucune authentification sur les API | Extension prévue par le sujet : Spring Security + JWT, rôles ADMIN (écriture capteurs, recalculs) et VIEWER (lecture) |
| 2 | Ports des bases publiés sur l'hôte | En production, retirer les `ports:` de MongoDB, Redis et Cassandra (accès uniquement par le réseau Docker) |
| 3 | ai-service : CORS `allow_origins=["*"]` avec `allow_credentials=True` | Limiter aux origines du front |
| 4 | Endpoint de test `POST /api/cassandra/test/write` | Le retirer ou le réserver à un profil `dev` |
| 5 | `management.endpoint.health.show-details=always` (analytics) | Passer à `when-authorized` en production |
| 6 | Pas de limite de débit sur `POST /api/measurements` | Limitation par client (API Gateway ou filtre) si le service est exposé |
| 7 | Pas de profils Spring `dev` / `prod` | Créer `application-prod.properties` (sans endpoint de test, détails santé masqués) |
| 8 | Fichier `storage-service/src/main/resources/application.properties.bak` versionné | Le supprimer (pas de secret dedans, mais configuration obsolète) |

## 6. Extensions non réalisées

Spring Security, authentification JWT, rôles ADMIN / VIEWER, OAuth2 et HTTPS via reverse proxy (extensions listées
par le sujet) ne sont pas implémentés : le MVP est utilisé en local. Les recommandations 1 à 7 indiquent par où commencer.
