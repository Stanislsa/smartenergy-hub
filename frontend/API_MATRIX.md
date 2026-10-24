# Matrice d'intégration Frontend/Backend - SmartEnergy Hub

## Vue d'ensemble de l'architecture

### Services Backend
| Service | Port | Type | Rôle | Source de données |
|---------|------|------|------|-------------------|
| Collector | 8081 | Spring Boot | Collecte des mesures des capteurs | → Storage (Kafka/Redis) |
| Storage | 8082 | Spring Boot | Persistance des mesures | Cassandra |
| Analytics | 8083 | Spring Boot | Calculs d'anomalies et résumés | MongoDB (capteurs), Cassandra (mesures) |
| AI | 8085 | FastAPI | Prévisions par Random Forest | Modèle ML entraîné |
| MongoDB | 27018 | Base de données | Métadonnées des capteurs, résumés journaliers | Analytics-service |
| Cassandra | 9042 | Base de données | Séries temporelles des mesures | Analytics-service |
| Redis | - | Cache | Buffer de messages (non exposé au frontend) | Collector/Storage |

### Configuration par environnement
Les URLs sont configurées via le proxy Vite (`vite.config.js`) :
- Développement : `http://localhost:5173` → proxy vers services locaux
- Production : URL de base configurable via `VITE_API_BASE_URL`

---

## Matrice Pages → Endpoints → Services → Sources de données

### 1. Dashboard (`/`)
| Endpoint | Méthode | Service Backend | Source de données | React Query Key | staleTime |
|----------|---------|-----------------|------------------|-----------------|-----------|
| `api.sensors()` | GET | Analytics (8083) | MongoDB | `['sensors']` | 60s |
| `api.latest(sensorId)` | GET | Analytics (8083) | Cassandra | `['latest', sensorId]` | 60s |
| `recentAnomalies(sensors)` | GET (multiple) | Analytics (8083) | Cassandra | - | - |
| `api.history(sensorId, from, to, limit)` | GET | Analytics (8083) | Cassandra | `['power-chart', sensorId, period]` | 60s |

**Fonctions utilitaires appelées :**
- `last24h()` : calcule la plage des 24 dernières heures (UTC)
- `recentAnomalies()` : agrège les anomalies de tous les capteurs actifs

**Données affichées :**
- KPIs : énergie totale, puissance moyenne, capteurs actifs, anomalies récentes
- Graphique : puissance du capteur sélectionné sur la période
- Liste des anomalies récentes

---

### 2. Capteurs (`/capteurs`)
| Endpoint | Méthode | Service Backend | Source de données | React Query Key | staleTime |
|----------|---------|-----------------|------------------|-----------------|-----------|
| `api.sensors()` | GET | Analytics (8083) | MongoDB | `['sensors']` | 60s |
| `api.latest(sensorId)` | GET (multiple) | Analytics (8083) | Cassandra | - | - |
| `api.createSensor(body)` | POST | Analytics (8083) | MongoDB | - | - |

**Fonctions utilitaires appelées :**
- `loadSensors()` : charge les capteurs avec leur dernière mesure

**Données affichées :**
- Tableau des capteurs : ID, nom, bâtiment, statut, dernière mesure
- Modal de création de capteur

**Tri :** sensorId, name, building (asc/desc)
**Filtre :** statut (actif/inactif)

---

### 3. Historique (`/historique`)
| Endpoint | Méthode | Service Backend | Source de données | React Query Key | staleTime |
|----------|---------|-----------------|------------------|-----------------|-----------|
| `api.sensors()` | GET | Analytics (8083) | MongoDB | `['sensors']` | 60s |
| `api.history(sensorId, from, to, limit)` | GET | Analytics (8083) | Cassandra | `['history', sensorId, from, to]` | 60s |

**Fonctions utilitaires appelées :**
- `daysRange(start, end)` : calcule la plage de jours inclusive (UTC)
- `dayRange(dateStr)` : calcule une journée UTC [00:00; 00:00 du lendemain[

**Données affichées :**
- Filtres : capteur, période (dates), métrique
- Graphique : métrique sélectionnée sur la période
- Tableau : timestamp, métriques (powerKw, voltage, temperature, current)

**Tri :** timestamp, powerKw, voltage, temperature, current (asc/desc)
**Pagination :** 50 lignes par page

---

### 4. Anomalies (`/anomalies`)
| Endpoint | Méthode | Service Backend | Source de données | React Query Key | staleTime |
|----------|---------|-----------------|------------------|-----------------|-----------|
| `api.sensors()` | GET | Analytics (8083) | MongoDB | `['sensors']` | 60s |
| `api.anomalies(sensorId, from, to)` | GET (multiple) | Analytics (8083) | Cassandra | `['anomalies', sensorId, from, to]` | 60s |

**Fonctions utilitaires appelées :**
- `daysRange(start, end)` : calcule la plage de jours inclusive (UTC)
- `settle()` : exécute les requêtes sans lever d'exception

**Données affichées :**
- Filtres : capteur, méthode (THRESHOLD, Z_SCORE, POWER_VARIATION, VOLTAGE, TEMPERATURE), dates
- Badges : compteurs par méthode
- Tableau : date/heure, capteur, méthode, valeur observée, seuil, explication

**Tri :** timestamp, method (asc/desc)
**Pagination :** 15 lignes par page
**Limite période :** 31 jours maximum (limite API)

---

### 5. Résumé journalier (`/resume`)
| Endpoint | Méthode | Service Backend | Source de données | React Query Key | staleTime |
|----------|---------|-----------------|------------------|-----------------|-----------|
| `api.sensors()` | GET | Analytics (8083) | MongoDB | `['dailySummary', date]` | 60s |
| `api.dailySummary(sensorId, date)` | GET (multiple) | Analytics (8083) | MongoDB | - | - |
| `api.summary(sensorId, from, to)` | GET (multiple) | Analytics (8083) | Cassandra | - | - |
| `api.anomalies(sensorId, from, to)` | GET (multiple) | Analytics (8083) | Cassandra | - | - |
| `api.history(sensorId, from, to, limit)` | GET | Analytics (8083) | Cassandra | `['dayChart', sensorId, date]` | 60s |

**Fonctions utilitaires appelées :**
- `loadDay(date)` : charge le résumé pour une journée (priorité MongoDB, fallback calcul Analytics)
- `dayRange(dateStr)` : calcule une journée UTC

**Données affichées :**
- Filtre : date
- KPIs : énergie totale, puissance maximale, anomalies, capteurs avec données
- Graphique : puissance de la journée pour un capteur
- Top 3 capteurs par énergie
- Anomalies par méthode
- Tableau : capteur, mesures, puissance moy/max, énergie, anomalies, source (MongoDB/Calculé)

**Tri :** sensorId, measurements, avg, max, energy, anomalyCount (asc/desc)

**Sources de données :**
- Priorité 1 : `api.dailySummary()` (résumé pré-calculé dans MongoDB)
- Priorité 2 : `api.summary()` + `api.anomalies()` (calculé à la volée par Analytics)

---

### 6. Prévisions (`/prevision`)
| Endpoint | Méthode | Service Backend | Source de données | React Query Key | staleTime |
|----------|---------|-----------------|------------------|-----------------|-----------|
| `api.sensors({ active: true })` | GET | Analytics (8083) | MongoDB | `['sensors', 'active']` | 60s |
| `api.modelStatus()` | GET | AI (8085) | Modèle ML | `['modelStatus']` | 60s |
| `api.history(sensorId, from, to, limit)` | GET | Analytics (8083) | Cassandra | - | - |
| `api.forecast(sensorId, horizonMinutes)` | POST (multiple) | AI (8085) | Modèle ML | - | - |

**Fonctions utilitaires appelées :**
- `last24h()` : calcule la plage des 24 dernières heures (UTC)
- `settle()` : exécute les requêtes sans lever d'exception

**Données affichées :**
- Filtres : capteur, horizon (1h, 6h, 12h, 24h)
- Graphique : historique (24h) + prévision (6 points sur l'horizon)
- Résultats : puissance prévue, intervalle de confiance (95%), instant prévu, version du modèle
- Statut du modèle : nom, type, statut, version

**Paramètres de prévision :**
- `sensor_id` : ID du capteur
- `horizon_minutes` : horizon en minutes (1-1440)
- `STEPS = 6` : nombre de points de prévision calculés

---

## Gestion des erreurs et timeouts

### Client API (`src/api/client.js`)
- **Timeouts** : Non configurés explicitement (dépend du navigateur)
- **Erreurs réseau** : `ApiError(0, 'Service injoignable')`
- **Erreurs HTTP** : `ApiError(status, message)`
- **Codes spéciaux** : 500/502/504 sans corps → "Service injoignable"
- **Parsing JSON** : Échec silencieux, retourne le texte brut

### React Query (`src/lib/queryClient.js`)
- **Retries** : 3 tentatives par défaut
- **Retry delay** : Exponentiel (1s, 2s, 4s)
- **Stale time** : 60s par défaut (configurable par requête)
- **Cache time** : 5 minutes par défaut

### Gestion des erreurs dans les pages
- **ErrorBox** : Affiche les erreurs avec bouton de retry
- **settle()** : Exécute les requêtes sans lever d'exception (utilisé pour les appels parallèles)
- **ErrorBoundary** : Capture les erreurs React non gérées

---

## Formats de dates, fuseaux horaires et unités

### Dates et heures
| Fonction | Format | Fuseau | Usage |
|----------|--------|--------|-------|
| `todayIso()` | `YYYY-MM-DD` | UTC | Input date par défaut |
| `daysAgoIso(n)` | `YYYY-MM-DD` | UTC | Calcul de dates passées |
| `dayRange(dateStr)` | ISO 8601 | UTC | Journée UTC [00:00; 00:00 du lendemain[ |
| `daysRange(start, end)` | ISO 8601 | UTC | Plage de jours inclusive |
| `last24h()` | ISO 8601 | UTC | 24 dernières heures |
| `dateTime(iso)` | `DD/MM/YYYY HH:mm` | Local | Affichage |
| `timeShort(iso)` | `HH:mm` | Local | Affichage court |
| `dayShort(iso)` | `DD/MM` | Local | Affichage jour |
| `relative(iso)` | Relatif | Local | "il y a X min/h/j" |

### Unités énergétiques
| Grandeur | Unité | Précision | Fonction |
|----------|-------|----------|----------|
| Puissance | kW | 2 décimales | `num(value, 2)` |
| Énergie | kWh | 1 décimale | `num(value, 1)` |
| Tension | V | 0-1 décimale | `num(value, 0/1)` |
| Température | °C | 0-1 décimale | `num(value, 0/1)` |
| Courant | A | 2 décimales | `num(value, 2)` |
| Pourcentage | % | 0-1 décimale | `num(value, 0/1)` |

### Locale
- **Formatage** : `fr-FR` (séparateur décimal = virgule, séparateur milliers = espace)
- **Libellés** : `fr-FR` (noms des mois, jours)

---

## Cohérence des données entre services

### Flux de données
1. **Collector** → **Storage** (Kafka/Redis) : Mesures brutes
2. **Storage** → **Cassandra** : Persistance des séries temporelles
3. **Analytics** → **MongoDB** : Métadonnées des capteurs, résumés journaliers
4. **Analytics** → **Cassandra** : Lecture des mesures pour calculs
5. **Analytics** → **AI** : Données pour entraînement/prévision (non exposé au frontend)

### Points de cohérence
- **Timestamps** : ISO 8601 UTC partout
- **Sensor IDs** : Chaînes de caractères, cohérents entre MongoDB et Cassandra
- **Unités** : kW, kWh, V, °C, A cohérents entre services
- **Statuts** : `active: boolean` cohérent entre MongoDB et frontend

### Disponibilité des données
- **MongoDB** : Capteurs toujours disponibles (source de vérité)
- **Cassandra** : Mesures disponibles si capteur a des données (404 sinon)
- **Résumés journaliers** : Priorité MongoDB, fallback calcul Analytics
- **Prévisions IA** : Dépend du modèle entraîné (503 si modèle absent)

---

## Scénarios d'indisponibilité de services

### MongoDB indisponible
- **Impact** : Impossible de lister les capteurs (`api.sensors()`)
- **Comportement frontend** : ErrorBox sur toutes les pages
- **Détection** : `checkServices()` → `mongodb: false`

### Cassandra indisponible
- **Impact** : Impossible de lire les mesures (`api.history()`, `api.latest()`)
- **Comportement frontend** :
  - Dashboard : KPIs avec "—", graphique vide
  - Historique : EmptyState
  - Résumé journalier : source "error" dans le tableau
- **Détection** : `checkServices()` → `cassandra: false`

### Analytics indisponible
- **Impact** : Tous les endpoints `/api/*` indisponibles
- **Comportement frontend** : ErrorBox sur toutes les pages
- **Détection** : `checkServices()` → `analytics: false`

### AI indisponible
- **Impact** : Prévisions impossibles (`api.forecast()`, `api.modelStatus()`)
- **Comportement frontend** :
  - Page Prévisions : ErrorBox avec message spécifique (503 ou 0)
- **Détection** : `checkServices()` → `ai: false`

### Collector/Storage indisponibles
- **Impact** : Pas de nouvelles mesures (données existantes toujours accessibles)
- **Comportement frontend** : Pas d'erreur directe, données obsolètes
- **Détection** : `checkServices()` → `collector: false` / `storage: false`

### Redis indisponible
- **Impact** : Non visible depuis le frontend (buffer interne)
- **Comportement frontend** : Pas d'impact direct
- **Détection** : Non exposé

---

## États de chargement et fraîcheur des données

### États de chargement React Query
| État | Comportement | Affichage |
|------|--------------|-----------|
| `isLoading` | Requête en cours | `CardSkeleton` ou `Loading` |
| `isError` | Erreur après retries | `ErrorBox` avec bouton retry |
| `isFetching` | Requête en arrière-plan (rafraîchissement) | Indicateur optionnel |
| `isPaused` | Requête en pause (offline) | Données obsolètes affichées |

### Fraîcheur des données
| Page | staleTime | Refetch | Affichage last update |
|------|-----------|---------|----------------------|
| Dashboard | 60s | Bouton refresh | Oui |
| Capteurs | 60s | Bouton refresh | Oui |
| Historique | 60s | Bouton refresh | Oui |
| Anomalies | 60s | Bouton refresh | Oui |
| Résumé journalier | 60s | Bouton refresh | Oui |
| Prévisions | 60s | Bouton refresh (statut modèle) | Oui (génération) |

### Cache React Query
- **Durée par défaut** : 5 minutes
- **Stale time** : 60s (données considérées fraîches)
- **Garbage collection** : Après 5 minutes d'inactivité
- **Persistance** : Non (cache en mémoire uniquement)

---

## Résumé des endpoints par service

### Analytics Service (8083)
| Endpoint | Méthode | Source | Description |
|----------|---------|--------|-------------|
| `/api/sensors` | GET | MongoDB | Liste des capteurs |
| `/api/sensors` | POST | MongoDB | Créer un capteur |
| `/api/sensors/{id}` | GET | MongoDB | Détails d'un capteur |
| `/api/sensors/{id}/daily-summary` | GET | MongoDB | Résumé journalier pré-calculé |
| `/api/measurements/{id}` | GET | Cassandra | Historique des mesures |
| `/api/measurements/{id}/latest` | GET | Cassandra | Dernière mesure |
| `/api/analytics/{id}/summary` | GET | Cassandra | Résumé calculé |
| `/api/analytics/{id}/anomalies/all` | GET | Cassandra | Anomalies détectées |
| `/svc/analytics/health` | GET | - | Santé du service |

### AI Service (8085)
| Endpoint | Méthode | Source | Description |
|----------|---------|--------|-------------|
| `/ai/api/v1/forecasts/predict` | POST | Modèle ML | Prévision de puissance |
| `/ai/api/v1/model/status` | GET | Modèle ML | Statut du modèle |
| `/svc/ai/health` | GET | - | Santé du service |

### Storage Service (8082)
| Endpoint | Méthode | Source | Description |
|----------|---------|--------|-------------|
| `/svc/storage/health` | GET | - | Santé du service |

### Collector Service (8081)
| Endpoint | Méthode | Source | Description |
|----------|---------|--------|-------------|
| `/svc/collector/health` | GET | - | Santé du service |

---

## Notes et recommandations

### Points d'amélioration identifiés
1. **Timeouts** : Ajouter des timeouts explicites dans `fetch()` (ex: 30s)
2. **Retry config** : Personnaliser les retries par endpoint (ex: moins pour les prévisions)
3. **Cache persistence** : Ajouter la persistance du cache React Query (localStorage)
4. **Error boundaries** : Ajouter des ErrorBoundary par page pour isoler les erreurs
5. **Loading states** : Améliorer les indicateurs de chargement en arrière-plan (`isFetching`)
6. **Offline support** : Ajouter la détection offline et la mise en cache des requêtes
7. **WebSocket** : Ajouter WebSocket pour les mises à jour en temps réel (optionnel)

### Tests recommandés
1. **Tests d'intégration** : Tester chaque endpoint avec mock backend
2. **Tests de charge** : Vérifier le comportement avec beaucoup de capteurs/mesures
3. **Tests d'erreur** : Simuler l'indisponibilité de chaque service
4. **Tests de fuseau horaire** : Vérifier l'affichage avec différents fuseaux
5. **Tests de locale** : Vérifier l'affichage avec différentes locales

### Monitoring
- **Health checks** : `useServices()` toutes les 30s
- **Performance** : Ajouter des logs de temps de réponse React Query
- **Erreurs** : Centraliser les logs d'erreurs (ex: Sentry)
