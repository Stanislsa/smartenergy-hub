# Smart Energy Hub

Projet multi-module Spring Boot pour la collecte, le stockage et l'analyse des données énergétiques.

## 🏗️ Architecture

```
smartenergy-hub/
├── pom.xml                 (POM parent)
├── docker-compose.yml      (MongoDB, Redis, Cassandra)
├── collector-service/     (port 8081) - Collecte les données énergétiques
├── storage-service/       (port 8082) - Stocke les données dans MongoDB/Redis
├── analytics-service/     (port 8083) - API de lecture pour l'analyse
├── simulator/             (Python) - Simulateur de données énergétiques
└── scripts/
    └── init-cassandra.cql
```

## 🚀 Démarrage Rapide

### Prérequis
- Java 17
- Maven 3.8+
- Docker & Docker Compose
- Python 3.x (pour le simulateur)

### Démarrage du projet

1. **Démarrer les bases de données avec Docker Compose**
   ```bash
   docker compose up -d
   ```

2. **Initialiser Cassandra**
   ```bash
   docker cp scripts/init-cassandra.cql smartenergy-hub-cassandra-1:/tmp/init-cassandra.cql
   docker exec smartenergy-hub-cassandra-1 cqlsh -f /tmp/init-cassandra.cql
   ```

3. **Construire le projet**
   ```bash
   ./mvnw clean install -DskipTests
   ```

4. **Démarrer les services**
   ```bash
   # Terminal 1
   cd collector-service && java -jar target/collector-service-0.0.1-SNAPSHOT.jar
   
   # Terminal 2
   cd storage-service && java -jar target/storage-service-0.0.1-SNAPSHOT.jar
   
   # Terminal 3
   cd analytics-service && java -jar target/analytics-service-0.0.1-SNAPSHOT.jar
   ```

5. **Lancer le simulateur (optionnel)**
   ```bash
   cd simulator
   pip install -r requirements.txt
   python energy_simulator.py
   ```

### Points de terminaison des services

- **Collector Service**: http://localhost:8081
- **Storage Service**: http://localhost:8082
- **Analytics Service**: http://localhost:8083

Chaque service dispose de :
- `/` - Statut du service
- `/health` - Vérification de santé

### Ports des bases de données

- **MongoDB**: localhost:27018
- **Redis**: localhost:6380
- **Cassandra**: localhost:9042

---

## 📋 Guide du Workflow Git

Ce projet suit un workflow Git Flow pour assurer un développement organisé et des déploiements sûrs.

### 1. Infrastructure et Accès au Dépôt

Le code est centralisé sur une plateforme cloud (GitHub, GitLab ou Bitbucket).

**Sécurité :**
- Accès protégé via clés SSH ou jetons d'authentification
- Différents niveaux de permission selon le rôle

**Permissions :**
- **Développeurs Juniors** : Lecture/Écriture uniquement sur les branches de fonctionnalités
- **Développeurs Seniors** : Lecture/Écriture sur les branches de fonctionnalités et develop
- **Tech Leads / DevOps** : Accès complet incluant les branches main/release

### 2. Structure des Branches

| Type de Branche | Nom Typique | Rôle et Accès |
|----------------|-------------|---------------|
| **Production** | `main` | Contient le code actuellement en production. Strictement protégée - seuls les leads peuvent fusionner ici. |
| **Pré-production** | `release` | Environnement de test identique à la production avant le déploiement final. |
| **Développement** | `develop` | Branche centrale pour toutes les nouvelles fonctionnalités. Base de travail de l'équipe. |
| **Fonctionnalité** | `feature/nom-tâche` | Créée par les développeurs pour des tâches spécifiques (ex: `feature/connexion-facebook`). |
| **Correction urgente** | `hotfix/nom-bug` | Créée directement depuis `main` pour les corrections de bugs critiques en production. |

### 3. Workflow Quotidien du Développeur

Lorsque vous travaillez sur une tâche, suivez ces étapes :

#### Étape 1 : Synchronisation
Commencez toujours à partir de la dernière version propre de la branche commune (`develop`) :
```bash
git checkout develop
git pull origin develop
```

#### Étape 2 : Créer une Branche de Fonctionnalité
Créez votre propre branche locale pour la tâche :
```bash
git checkout -b feature/ajout-panier
```

#### Étape 3 : Développement
Codez et faites des commits réguliers pour sauvegarder votre progression :
```bash
git add .
git commit -m "Ajouter la fonctionnalité du panier"
```

#### Étape 4 : Publication (Push)
Envoyez votre branche vers le dépôt distant :
```bash
git push origin feature/ajout-panier
```

#### Étape 5 : Pull Request (PR) / Merge Request (MR)
Créez une PR/MR pour fusionner votre travail dans `develop` :
- Allez sur l'interface web de GitHub/GitLab
- Créez une nouvelle Pull Request de `feature/ajout-panier` vers `develop`
- Ajoutez une description des modifications

#### Étape 6 : Revue de Code
Les membres de l'équipe révise votre code :
- Ils peuvent laisser des commentaires ou demander des modifications
- Ils approuvent (Approve) lorsqu'ils sont satisfaits

#### Étape 7 : Intégration CI/CD
Les outils automatisés (Jenkins, GitHub Actions, GitLab CI) exécutent :
- Tests automatisés
- Vérifications de qualité de code
- Analyses de sécurité

#### Étape 8 : Fusion
Une fois approuvé par l'équipe et les tests automatisés :
- Fusionnez la PR dans `develop`
- Supprimez la branche de fonctionnalité

### 4. Quelle Branche Utiliser ?

**Pour les nouvelles fonctionnalités :**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/nom-de-votre-fonctionnalite
# ... travaillez sur la fonctionnalité ...
git push origin feature/nom-de-votre-fonctionnalite
# Créez une PR vers develop
```

**Pour les corrections de bugs en production :**
```bash
git checkout main
git pull origin main
git checkout -b hotfix/correction-bug-critique
# ... corrigez le bug ...
git push origin hotfix/correction-bug-critique
# Créez une PR vers main ET develop
```

**Pour préparer une release :**
```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0
# ... tests finaux et ajustements ...
git push origin release/v1.0.0
# Créez une PR vers main
```

### 5. Règles de Protection des Branches

**Branches protégées (ne peuvent pas être poussées directement) :**
- `main` - Uniquement via Pull Request avec approbation
- `release` - Uniquement via Pull Request avec approbation

**Branche de développement :**
- `develop` - Peut être poussée, mais les fusions nécessitent une revue

### 6. Commandes Courantes

```bash
# Voir toutes les branches
git branch -a

# Basculer vers une branche
git checkout nom-branche

# Créer et basculer vers une nouvelle branche
git checkout -b nouvelle-branche

# Fusionner une branche
git merge branche-fonctionnalite

# Supprimer une branche locale
git branch -d nom-branche

# Supprimer une branche distante
git push origin --delete nom-branche
```

---

## 🛠️ Stack Technologique

- **Java 17**
- **Spring Boot 3.3.4**
- **MongoDB** - Stockage de documents
- **Redis** - Mise en cache
- **Cassandra** - Données de séries temporelles
- **Maven** - Outil de build
- **Docker** - Conteneurisation
- **Python** - Simulation de données

---

## 📝 Notes de Développement

- Cassandra est activé et configuré dans `storage-service` et `analytics-service` avec le keyspace `smartenergy` et le local-datacenter `datacenter1`.
- Le port MongoDB a été changé à 27018 pour éviter le conflit avec l'instance MongoDB locale.
- Le port Redis a été changé à 6380 pour éviter le conflit avec l'instance Redis locale.

---

## 🤝 Contribution

Suivez le guide du Workflow Git ci-dessus. Toutes les modifications doivent passer par des Pull Requests avec approbation de revue de code.
