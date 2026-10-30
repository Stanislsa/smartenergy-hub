# Audit SmartEnergy Hub - État actuel vs Cahier des charges

**Date de l'audit :** 29 octobre 2026  
**Branche actuelle :** feature/fix-ai-forecast-services  
**Référence :** Projet_Complet_Spring_Boot_Guide(3).pdf

---

## 1. Structure du projet

### 1.1 Architecture modulaire Spring Boot
**État :** ✅ IMPLÉMENTÉ

- **4 modules Maven détectés :**
  - `pom.xml` (parent)
  - `collector-service/pom.xml`
  - `storage-service/pom.xml`
  - `analytics-service/pom.xml`

### 1.2 Services Backend
**État :** ✅ IMPLÉMENTÉ

| Service | Port | Contrôleurs détectés |
|---------|------|---------------------|
| Collector Service | 8081 | MeasurementController, HomeController |
| Storage Service | 8082 | HomeController, CassandraTestController |
| Analytics Service | 8083 | MeasurementController, HomeController, AnalyticsController, SensorController |
| AI Service (FastAPI) | 8085 | health, anomalies, forecasts, model_status, alerts, efficiency, lstm-forecasts |

### 1.3 Frontend React
**État :** ✅ IMPLÉMENTÉ

- **6 pages détectées :**
  - Dashboard.jsx
  - Sensors.jsx
  - History.jsx
  - Anomalies.jsx
  - DailySummary.jsx
  - Forecast.jsx
- **Technologie :** React + Vite
- **API client :** React Query

### 1.4 Tests
**État :** ⚠️ PARTIEL

- **13 fichiers de test Java détectés :**
  - Analytics : 12 tests (SensorService, AnalyticsController, EnergyCalculator, AnomalyDetector, CassandraMeasurementReader, etc.)
  - Collector : 1 test (GlobalExceptionHandlerMetricsTest)
- **Manque :** Tests d'intégration Redis/Cassandra/MongoDB, tests E2E frontend

---

## 2. Endpoints API vs Cahier des charges

### 2.1 Collector Service (Port 8081)
**État :** ✅ IMPLÉMENTÉ

| Route cible | Route actuelle | Statut | Notes |
|-------------|----------------|--------|-------|
| POST /api/measurements | POST /api/measurements | ✅ | Validation Jakarta, HTTP 202, publication Redis Streams |
| GET /health | GET /health | ✅ | Endpoint santé |
| GET /api/health | GET /api/health | ✅ | Endpoint santé alternatif |

**Documentation Swagger :** ✅ Présente (annotations @Operation, @ApiResponse)

---

### 2.2 Storage Service (Port 8082)
**État :** ⚠️ PARTIEL

| Route cible | Route actuelle | Statut | Notes |
|-------------|----------------|--------|-------|
| GET /health | GET /health | ✅ | Endpoint santé |
| GET / | GET / | ✅ | Endpoint racine |
| Consumer Redis Streams | ❌ NON VISIBLE | ⚠️ | Consumer Redis non visible dans les contrôleurs (doit être dans service) |

**Manque :** Endpoints API de consultation (Storage ne devrait exposer que des endpoints de santé selon le guide)

---

### 2.3 Analytics Service (Port 8083)
**État :** ✅ BIEN IMPLÉMENTÉ

| Route cible | Route actuelle | Statut | Notes |
|-------------|----------------|--------|-------|
| GET /api/sensors | GET /api/sensors | ✅ | Liste avec filtres (building, active) |
| GET /api/sensors/{id} | GET /api/sensors/{sensorId} | ✅ | Détail capteur |
| POST /api/sensors | POST /api/sensors | ✅ | Création capteur |
| PUT /api/sensors/{id} | PUT /api/sensors/{sensorId} | ✅ | Modification capteur |
| GET /api/measurements/{id}/latest | GET /api/measurements/{sensorId}/latest | ✅ | Dernière mesure |
| GET /api/measurements/{id}?from=...&to=... | GET /api/measurements/{sensorId} | ✅ | Historique avec pagination |
| GET /api/analytics/{id}/summary | GET /api/analytics/{sensorId}/summary | ✅ | Résumé analytique |
| GET /api/analytics/{id}/anomalies | GET /api/analytics/{sensorId}/anomalies | ✅ | Anomalies (seuil + z-score) |
| GET /api/sensors/{id}/daily-summary | GET /api/sensors/{sensorId}/daily-summary | ✅ | Résumé quotidien |
| POST /api/sensors/{id}/daily-summary/compute | POST /api/sensors/{sensorId}/daily-summary/compute | ✅ | Calcul résumé quotidien |
| GET /api/analytics/{id}/anomalies/all | GET /api/analytics/{sensorId}/anomalies/all | ✅ | Détection complète anomalies |

**Documentation Swagger :** ✅ Présente

**Routes supplémentaires :**
- GET /api/analytics/{sensorId}/anomalies/all (détection étendue avec variation, voltage, température)

---

### 2.4 AI Service (Port 8085 - FastAPI)
**État :** ✅ IMPLÉMENTÉ

| Route cible | Route actuelle | Statut | Notes |
|-------------|----------------|--------|-------|
| GET /health | GET /health | ✅ | Endpoint santé |
| POST /api/v1/anomalies/predict | POST /api/v1/anomalies/predict | ✅ | Détection anomalie (Isolation Forest) |
| POST /api/v1/forecasts/predict | POST /api/v1/forecasts/predict | ✅ | Prévision Random Forest |
| POST /api/v1/lstm-forecasts/predict | POST /api/v1/lstm-forecasts/predict | ✅ | Prévision LSTM |
| GET /api/v1/model/status | GET /api/v1/model/status | ✅ | État modèle |
| POST /api/v1/alerts/ | POST /api/v1/alerts/ | ✅ | Création alerte |
| GET /api/v1/alerts/active | GET /api/v1/alerts/active | ✅ | Alertes actives |
| GET /api/v1/alerts/{sensor_id} | GET /api/v1/alerts/{sensor_id} | ✅ | Historique alertes |
| GET /api/v1/efficiency/{sensor_id} | GET /api/v1/efficiency/{sensor_id} | ✅ | Efficacité énergétique |

**Routes supplémentaires non demandées par le guide :**
- Alerts (gestion des alertes)
- Efficiency (analyse d'efficacité)

---

## 3. Base de données et Stockage

### 3.1 Redis Streams
**État :** ⚠️ À VALIDER

- **Configuration :** Présente dans docker-compose.yml
- **Consumer group :** `storage-group` mentionné dans le guide
- **Validation requise :**
  - [ ] Prouver que Collector publie effectivement dans Redis
  - [ ] Prouver que Storage consomme depuis Redis
  - [ ] Tester la reprise après panne (messages non acquittés)
  - [ ] Tester la gestion des doublons

### 3.2 Cassandra
**État :** ✅ IMPLÉMENTÉ

- **Schéma :** `measurements_by_sensor_day` (confirmé par CassandraTestController)
- **Endpoints de test :**
  - POST /api/cassandra/test/write
  - GET /api/cassandra/test/read/{sensorId}
  - GET /api/cassandra/test/latest/{sensorId}
- **Validation requise :**
  - [ ] Vérifier que les endpoints Analytics utilisent correctement ce schéma
  - [ ] Tester les performances sur volume significatif
  - [ ] Confirmer la persistance après redémarrage

### 3.3 MongoDB
**État :** ✅ IMPLÉMENTÉ

- **Endpoints capteurs :** Présents dans SensorController (Analytics Service)
- **Fonctions :**
  - ✅ POST /api/sensors (création)
  - ✅ GET /api/sensors (liste)
  - ✅ GET /api/sensors/{id} (détail)
  - ✅ PUT /api/sensors/{id} (modification)
  - ✅ GET /api/sensors/{id}/daily-summary (résumé quotidien)
- **Validation requise :**
  - [ ] Confirmer que les agrégats journaliers sont persistés
  - [ ] Vérifier la cohérence entre capteurs MongoDB et mesures Cassandra

---

## 4. Frontend vs Cahier des charges

### 4.1 Pages existantes
**État :** ✅ 6/6 PAGES PRÉSENTES

| Page | Statut | Améliorations requises |
|------|--------|------------------------|
| Dashboard | ⚠️ À améliorer | Indicateurs énergétiques réels, graphiques par heure, statut système |
| Sensors | ⚠️ À améliorer | Pagination, filtres, création/modification capteurs |
| History | ⚠️ À améliorer | Filtres date, pagination backend, export CSV |
| Anomalies | ⚠️ À améliorer | Détails anomalie (type, sévérité, état traitement) |
| Daily Summary | ⚠️ À améliorer | Comparaison veille, export rapport |
| Forecasts | ⚠️ À améliorer | Sélecteur modèle, métriques MAE/RMSE/R², comparaison RF/LSTM |

### 4.2 Expérience utilisateur commune
**État :** ⚠️ À VALIDER

- [ ] Squelettes de chargement
- [ ] Messages d'erreur compréhensibles
- [ ] États vides avec explication
- [ ] Filtres cohérents
- [ ] Responsive mobile
- [ ] Accessibilité
- [ ] Performance (pagination, cache)
- [ ] Actualisation configurable

---

## 5. Modèles IA

### 5.1 Modèles entraînés
**État :** ✅ 3 MODÈLES

| Modèle | Usage | État |
|--------|-------|------|
| Isolation Forest | Détection anomalies (non supervisé) | ✅ Entraîné |
| Random Forest | Prévisions court terme | ✅ Entraîné (SENSOR-001, 002, 003) |
| LSTM | Prévisions long terme (168h) | ✅ Entraîné |

### 5.2 Métriques rapportées
**État :** ⚠️ À VALIDER

- Random Forest : MAE 0.38 kW, R² -0.20 à 0.57 (selon capteur)
- **Note :** Les métriques actuelles sont faibles (R² négatif pour certains capteurs)
- **Action requise :** Recalculer sur un jeu de test chronologique séparé

### 5.3 Fonctionnalités IA manquantes
**État :** ❌ NON IMPLÉMENTÉ

- [ ] Validation des données d'entrée
- [ ] Identification de version du modèle
- [ ] Enregistrement des métriques et date d'entraînement
- [ ] Détection de dérive des données
- [ ] Réentraînement planifié
- [ ] Possibilité de restaurer version précédente

---

## 6. Services transversaux

### 6.1 Sécurité
**État :** ❌ NON IMPLÉMENTÉ

- [ ] Spring Security
- [ ] JWT
- [ ] Rôles ADMIN/VIEWER
- [ ] Contrôle d'accès
- [ ] CORS limité
- [ ] Variables d'environnement pour secrets

### 6.2 Observabilité
**État :** ⚠️ PARTIEL

- [ ] Spring Boot Actuator (à vérifier dans configuration)
- [ ] Santé des bases de données
- [ ] Compteurs de mesures rejetées
- [ ] Messages Redis en attente
- [ ] Temps de traitement
- [ ] Prometheus/Grafana (extension)

### 6.3 Déploiement
**État :** ✅ DOCKER COMPOSE PRÉSENT

- **docker-compose.yml :** ✅ Présent
- **Services :** MongoDB, Redis, Cassandra, AI Service, Collector, Storage, Analytics
- **Volumes persistants :** À vérifier
- **Ordre de démarrage :** depends_on configuré
- **Validation requise :**
  - [ ] Redémarrage et reprise après interruption
  - [ ] README avec procédure reproductible

### 6.4 Tests
**État :** ⚠️ PARTIEL

- **Tests unitaires :** 13 tests Java (calculs, validations)
- **Manque :**
  - [ ] Tests d'intégration Redis
  - [ ] Tests d'intégration Cassandra
  - [ ] Tests d'intégration MongoDB
  - [ ] Tests des contrats JSON
  - [ ] Tests E2E frontend → backend
  - [ ] Test d'arrêt/redémarrage Storage Service
  - [ ] Tests de charge

---

## 7. Checklist de réalisation (0/24)

### Phase 1 — Stabiliser les API et les données (Critique)
- [ ] Corriger les 404, 422 et 500
- [ ] Vérifier les contrats React / Spring Boot / FastAPI
- [ ] Tester latest, history, daily-summary, anomalies et forecast

### Phase 2 — Valider la chaîne Big Data (Critique)
- [ ] Prouver Collector → Redis → Storage
- [ ] Prouver l'écriture et la lecture Cassandra
- [ ] Prouver les capteurs et agrégats MongoDB
- [ ] Tester les doublons et la reprise après panne

### Phase 3 — Terminer les fonctionnalités métier (Élevée)
- [ ] Calculer correctement l'énergie et les résumés
- [ ] Finaliser la gestion des capteurs
- [ ] Enregistrer et consulter les événements d'anomalie
- [ ] Documenter les contrats Swagger / OpenAPI

### Phase 4 — Finaliser l'interface (Élevée)
- [ ] Brancher chaque page aux vraies API
- [ ] Améliorer filtres, tableaux et graphiques
- [ ] Gérer chargement, erreurs et données absentes
- [ ] Vérifier le responsive et l'accessibilité

### Phase 5 — Industrialiser l'IA (Élevée)
- [ ] Valider les métriques sur un test chronologique
- [ ] Tracer les versions des modèles
- [ ] Ajouter surveillance et réentraînement contrôlé
- [ ] Vérifier les erreurs et les logs FastAPI

### Phase 6 — Sécuriser et livrer (Élevée)
- [ ] Vérifier secrets et accès
- [ ] Finaliser Docker Compose et les volumes
- [ ] Activer Actuator et les métriques utiles
- [ ] Exécuter les tests d'intégration, E2E et de charge
- [ ] Préparer README, rapport et démonstration

---

## 8. Résumé

### Points forts
- ✅ Architecture modulaire Spring Boot bien structurée
- ✅ 4 services backend implémentés
- ✅ Frontend React avec 6 pages
- ✅ 3 modèles IA entraînés
- ✅ Endpoints API principaux implémentés
- ✅ Documentation Swagger présente
- ✅ Tests unitaires présents (13 tests)

### Points critiques à corriger
- ⚠️ **Phase 1 :** Erreurs 404/422/500 sur frontend
- ⚠️ **Phase 2 :** Chaîne Collector → Redis → Storage non validée
- ⚠️ **Phase 2 :** Reprise après panne non testée
- ⚠️ **Phase 3 :** Calculs d'énergie non validés
- ⚠️ **Phase 5 :** Métriques IA faibles (R² négatif)
- ⚠️ **Phase 6 :** Tests d'intégration manquants

### Fonctionnalités manquantes
- ❌ Sécurité (JWT, rôles)
- ❌ Observabilité (Actuator, Prometheus)
- ❌ Tests d'intégration et E2E
- ❌ Gestion des versions de modèles IA
- ❌ Réentraînement automatisé

### Recommandation principale
**Ne pas ajouter de nouvelles technologies.** Corriger d'abord :
1. Les contrats API et erreurs frontend
2. La chaîne Redis/Cassandra/MongoDB
3. Brancher le frontend sur des données réelles

C'est le chemin le plus direct vers une plateforme cohérente et démontrable.

---

## 9. Kafka : Faut-il l'ajouter ?

**Réponse :** NON pour le MVP

- Le guide utilise Redis Streams pour le transport
- Kafka est mentionné comme une extension possible
- Ajouter Kafka maintenant augmenterait la complexité sans résoudre les problèmes actuels
- Priorité : Stabiliser Redis Streams avant d'envisager Kafka

---

**Audit terminé le 29 octobre 2026**
