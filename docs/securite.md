# Note de sécurité — Étape 12

État au 02/11/2026, branche `develop` (après la fusion de l'authentification JWT, PR #24). Cette note répond au
livrable de l'Étape 12 du sujet : secrets à protéger, accès exposés et mécanismes mis en place. Le projet tourne en
environnement de développement local ; les points « production » sont signalés comme recommandations.

## 1. Niveau minimal demandé par le sujet

| Exigence (Étape 12) | État | Détail |
|---|---|---|
| Ne pas exposer de mots de passe dans Git | ⚠️ | Aucun `.env` réel n'a jamais été commité (historique vérifié le 02/11). Mais `.env.example` contient des valeurs d'exemple utilisables telles quelles : un secret JWT et les mots de passe `admin123` / `viewer123` (section 5, n° 1) |
| Utiliser des variables d'environnement | ✅ | Bases : `SPRING_DATA_MONGODB_HOST`, `SPRING_DATA_REDIS_HOST`, `SPRING_CASSANDRA_CONTACT_POINTS`… ; authentification : `APP_SECURITY_ENABLED`, `APP_JWT_SECRET`, `APP_ADMIN_*`, `APP_VIEWER_*` ; ai-service : `CASSANDRA_HOST`, `CASSANDRA_USERNAME`, `CASSANDRA_PASSWORD` |
| Valider les entrées | ✅ | Voir section 4 |
| Ne pas exposer inutilement les ports des bases en production | ⚠️ | Ports des bases publiés sur l'hôte (27018, 6380, 9042) : utile en développement, à retirer en production |
| Définir des profils de configuration | ⚠️ | Profils Docker Compose `ai` et `all` ; profil Spring `mongo-only` (analytics-service). Pas de profils Spring `dev` / `prod` distincts |

## 2. Authentification et rôles (extension réalisée)

L'extension « Spring Security, authentification JWT, rôles ADMIN et VIEWER » du sujet est réalisée sur
**analytics-service**, qui sert toute l'API de consultation et le front.

| Élément | Fonctionnement |
|---|---|
| Activation | `APP_SECURITY_ENABLED=true`. **Désactivée par défaut** (`false` dans `docker-compose.yml`) : sans cette variable, toute l'API reste ouverte |
| Connexion | `POST /api/auth/login` (nom d'utilisateur, mot de passe) → jeton JWT signé HS256, valable **1 heure** ; `GET /api/auth/me` renvoie l'utilisateur connecté |
| Comptes | collection MongoDB `users`, mots de passe hachés avec **BCrypt** ; un compte ADMIN et un compte VIEWER sont créés au premier démarrage à partir des variables `APP_ADMIN_*` et `APP_VIEWER_*` |
| Secret de signature | `APP_JWT_SECRET`, au moins 32 caractères, sinon le service refuse de démarrer |
| Rôle VIEWER | lecture : toutes les requêtes `GET /api/**` |
| Rôle ADMIN | lecture et écriture : `POST`, `PUT`, `DELETE` sur `/api/**` (capteurs, recalcul des résumés), métriques Actuator |
| Accès publics | `/`, `/health`, `/api/auth/login`, Swagger, `/actuator/health`, `/actuator/info` |
| Erreurs | 401 « Authentification requise ou jeton invalide », 403 « Droits insuffisants pour cette opération » |
| Front | page de connexion ; jeton gardé dans `sessionStorage` (effacé à la fermeture de l'onglet), supprimé sur réponse 401 ; si l'authentification est désactivée, le front n'affiche pas la page de connexion |
| Scripts | `scripts/load/*.mjs` se connectent avec `API_USER` / `API_PASSWORD` quand l'API est protégée |

**Limite** : seul analytics-service est protégé. Collector (8081), Storage (8082) et ai-service (8085) restent
ouverts.

## 3. Secrets à protéger

| Secret | Où il est utilisé | Règle |
|---|---|---|
| `APP_JWT_SECRET` | analytics-service | fichier `.env` non versionné ou coffre de secrets ; valeur aléatoire propre à chaque déploiement |
| `APP_ADMIN_PASSWORD`, `APP_VIEWER_PASSWORD` | analytics-service (création des comptes) | idem ; à changer avant toute utilisation hors du poste de développement |
| Identifiants MongoDB, Redis, Cassandra | services Java, ai-service | variables d'environnement. En local, les bases tournent sans authentification |

Protection en place : `.env` et `.env.local` sont ignorés par Git (`.gitignore` racine et `frontend/.gitignore`).
Versionnés : `.env.example`, `ai-service/.env.example`, `frontend/.env.example`.

## 4. Accès exposés

### Ports publiés par `docker-compose.yml`

| Port hôte | Composant | Exposition nécessaire ? |
|---|---|---|
| 8081 | collector-service | oui (point d'entrée des mesures) |
| 8083 | analytics-service | oui (API de consultation) |
| 8082 | storage-service | non pour les utilisateurs (consomme Redis) ; utile au diagnostic |
| 8085 | ai-service | oui si le front affiche la prévision |
| 5173 | frontend (nginx, profil `all`) ou Vite (`npm run dev`) | oui |
| 27018 | MongoDB | **non en production** |
| 6380 | Redis | **non en production** |
| 9042 | Cassandra | **non en production** |

### Endpoints sensibles

| Endpoint | Protégé si sécurité activée ? | Risque |
|---|---|---|
| `POST /api/measurements` (collector) | non | injection de fausses mesures ou saturation (pas de limite de débit) |
| `POST /api/sensors`, `PUT /api/sensors/{id}` (analytics) | ADMIN | modification des capteurs et de leur `maxPowerKw` (fausse les dépassements) |
| `POST /api/sensors/{id}/daily-summary/compute` (analytics) | ADMIN | recalcul et réécriture des résumés MongoDB |
| `POST /api/auth/login` (analytics) | public | essais de mots de passe en série (pas de limite de tentatives) |
| `POST /api/cassandra/test/write` (storage) | non | écrit une mesure de test dans Cassandra : endpoint de test à retirer hors développement |
| `/api/v1/*` (ai-service) | non | prévisions et alertes ; coûteux en calcul |
| `/actuator/metrics` (collector, analytics) | ADMIN sur analytics, non sur collector | renseigne sur la charge et les erreurs |
| `/actuator/health` (collector, analytics) | public | l'Analytics détaille l'état de MongoDB, Cassandra et Redis (`show-details=always`) |
| `/swagger-ui`, `/v3/api-docs` | public | décrivent toute l'API |

## 5. Mécanismes en place

| Mécanisme | Où | Effet |
|---|---|---|
| Authentification JWT et rôles | analytics-service | voir section 2 |
| Mots de passe hachés (BCrypt) | analytics-service, collection `users` | aucun mot de passe en clair en base |
| Validation Jakarta du DTO de mesure | collector-service (`EnergyMeasurementRequest`) | champs obligatoires, plages plausibles (`powerKw` 0 à 1 000, `voltage` 0 à 500…), horodatage entre 365 jours dans le passé et 5 minutes dans le futur ; sinon HTTP 400 détaillé |
| Rejet des JSON mal formés | collector-service (`GlobalExceptionHandler`) | HTTP 400 ; compteurs `energy.measurements` `rejected_validation` / `rejected_format` |
| Validation des capteurs | analytics-service (`@Valid SensorRequest`) | `sensorId` au format `[A-Za-z0-9_-]{3,50}`, `name` et `building` obligatoires, `maxPowerKw` > 0 |
| Bornes des requêtes de lecture | analytics-service | période ≤ 31 jours, `from` < `to`, `limit` entre 1 et 5 000 |
| Validation Pydantic | ai-service | bornes sur l'horizon de prévision et les mesures |
| Messages invalides écartés | storage-service (`RedisStreamConsumer`) | un message illisible est acquitté et journalisé, pas relu en boucle |
| Requêtes Cassandra paramétrées | storage, analytics, ai-service | pas de concaténation de valeurs dans le CQL |
| Exposition Actuator limitée | collector, analytics | seulement `health`, `info`, `metrics` |
| Front sans accès direct aux bases | frontend | passe par le proxy (Vite en développement, nginx en Docker) vers les API |

## 6. Risques identifiés et recommandations

| # | Constat | Recommandation |
|---|---|---|
| 1 | `.env.example` contient un secret JWT et des mots de passe utilisables tels quels | Remplacer par des valeurs factices (`APP_JWT_SECRET=a-remplacer-32-caracteres-minimum`, `APP_ADMIN_PASSWORD=a-remplacer`) ; générer un secret par déploiement |
| 2 | Authentification désactivée par défaut, et limitée à analytics-service | L'activer hors démonstration locale ; protéger aussi `POST /api/measurements` (clé d'API par capteur) |
| 3 | Ports des bases publiés sur l'hôte | En production, retirer les `ports:` de MongoDB, Redis et Cassandra |
| 4 | ai-service : CORS `allow_origins=["*"]` avec `allow_credentials=True` | Limiter aux origines du front |
| 5 | Endpoint de test `POST /api/cassandra/test/write` | Le retirer ou le réserver à un profil `dev` |
| 6 | `management.endpoint.health.show-details=always` (analytics) | Passer à `when-authorized` en production |
| 7 | Pas de limite de débit sur `POST /api/measurements` ni sur `POST /api/auth/login` | Limitation par client (passerelle d'API ou filtre) |
| 8 | Pas de profils Spring `dev` / `prod` | Créer `application-prod.properties` (sécurité activée, endpoint de test retiré, détails de santé masqués) |
| 9 | Pas de HTTPS | Reverse proxy TLS devant le front et les API (extension du sujet) |

## 7. Extensions

| Extension du sujet | État |
|---|---|
| Spring Security | ✅ analytics-service |
| Authentification JWT | ✅ analytics-service |
| Rôles ADMIN et VIEWER | ✅ |
| OAuth2 | non réalisé |
| HTTPS via reverse proxy | non réalisé |
