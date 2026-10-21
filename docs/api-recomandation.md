# Architecture attendue — SmartEnergy Hub

L'objectif est de définir précisément comment les services de SmartEnergy Hub communiquent entre eux, quels ports ils utilisent, quelles données ils échangent et comment les mesures arrivent jusqu'à Cassandra.

La partie la plus importante pour ton intégration est le consommateur Redis du storage-service : il doit recevoir les mesures publiées par le Collector, les convertir au bon format, les enregistrer dans Cassandra et acquitter les messages après une persistance réussie.

Les ports ci-dessous reprennent les informations déjà communiquées dans notre échange. Les autres ports sont des valeurs à confirmer dans ton projet : ils ne doivent pas être considérés comme une configuration réellement vérifiée.

## 1. Architecture globale attendue

### 1. Collector
**Port 8081**
Reçoit les mesures par HTTP et valide le JSON.

```
POST /api/measurements
```

**Publication du message**

### 2. Redis Streams
**Port 6380 côté hôte**
Stocke les événements dans le flux `energy-measurements`.

**Consumer group :** `storage-group`

**Lecture avec un consumer group**

### 3. Storage-service — injecteur Redis
**Port 8082**, selon l'audit précédent
Lit les messages, vérifie les données et appelle le service de persistance Cassandra.

**Appel Java interne, pas HTTP**

### 4. CassandraMeasurementService

Transforme la mesure et écrit dans la table Cassandra.

**Composant interne au Storage-service**

**Après confirmation de l'écriture**

### 5. ACK Redis

Le message est acquitté dans le groupe `storage-group`.

---

Le CassandraMeasurementService n'a pas besoin d'un port HTTP propre : il s'agit normalement d'un composant Java appelé directement par le consommateur, au sein du même processus storage-service. Cassandra, en revanche, est un serveur externe auquel le service se connecte sur son port CQL.

## 2. Tableau des ports et des connexions

| Service | Port attendu | Communication | Rôle |
|---------|--------------|---------------|------|
| Collector | 8081 | HTTP entrant | Reçoit POST /api/measurements |
| Redis | 6380 côté hôte | TCP/Redis | Transporte les événements via Streams |
| Storage-service | 8082 | HTTP entrant, si ses endpoints sont activés | Expose les endpoints de test et exécute le consommateur Redis |
| Cassandra | 9042 par défaut | TCP/CQL | Stocke et interroge les mesures |
| MongoDB | 27017 par défaut | TCP/MongoDB | Métadonnées ou agrégats, selon l'architecture du projet |

Le port CQL par défaut de Cassandra est 9042. Les ports MongoDB et Redis doivent être confirmés dans la configuration réellement utilisée.

### Comment les services sont reliés

- **Navigateur ou client HTTP → Collector** : `http://localhost:8081/api/measurements`
- **Collector → Redis** : connexion TCP au serveur Redis sur localhost:6380 si les deux processus tournent sur la même machine.
- **Storage-service → Redis** : connexion au même serveur Redis, au flux `energy-measurements`, dans le groupe `storage-group`.
- **Storage-service → Cassandra** : connexion CQL au serveur Cassandra sur le port 9042, généralement via Spring Data Cassandra.
- **Storage-service → MongoDB** : connexion indépendante si le stockage des métadonnées ou des agrégats est activé.

Ces connexions ne sont pas toutes des appels HTTP. En particulier, le consommateur Redis et CassandraMeasurementService peuvent fonctionner dans le même processus Java ; le passage entre eux est alors un appel de méthode, sans port réseau intermédiaire.

### Attention à Docker et à WSL

`localhost` désigne la machine ou l'environnement réseau dans lequel le processus s'exécute. Ainsi, si le Collector, Redis, le Storage-service et Cassandra tournent dans des conteneurs distincts, ils doivent généralement utiliser les noms de services Docker et les ports internes des conteneurs, et non leurs ports publiés sur l'hôte.

Par exemple, si Redis est publié comme `6380:6379`, un programme exécuté sur l'hôte se connecte au port 6380, alors qu'un conteneur voisin utilise généralement `redis:6379`, si le service Docker s'appelle `redis`.

## 3. Les réponses attendues à chaque étape

Le système doit distinguer l'acceptation d'une mesure par le Collector de sa persistance effective dans Cassandra.

### Étape A — Le Collector reçoit une mesure

**Requête :**
```
POST http://localhost:8081/api/measurements
Content-Type: application/json

{
  "sensorId": "SENSOR-001",
  "timestamp": "2026-10-21T08:15:00Z",
  "powerKw": 3.72,
  "voltage": 226.4,
  "temperature": 29.1
}
```

**Réponse attendue si la validation réussit et que l'événement est publié dans Redis :**
```
HTTP/1.1 202 Accepted
```

Cela signifie que le Collector a accepté la mesure pour traitement asynchrone. Cela ne prouve pas encore que Cassandra l'a enregistrée.

**Si la mesure est invalide :**
```
HTTP/1.1 400 Bad Request
```

Le Collector doit renvoyer une erreur de validation et ne pas publier cette mesure dans Redis.

### Étape B — Redis reçoit l'événement

Le Collector publie un message dans :
- **Stream :** `energy-measurements`
- **Consumer group :** `storage-group`

**Exemple de commande de vérification :**
```bash
redis-cli -p 6380 XINFO STREAM energy-measurements
redis-cli -p 6380 XINFO GROUPS energy-measurements
redis-cli -p 6380 XRANGE energy-measurements - +
```

Résultat attendu : le flux existe, le groupe est créé et l'événement contient les champs convenus.

**Attention :** `XRANGE` permet de vérifier la présence d'un message dans le flux, mais pas de prouver que Cassandra l'a traité.

### Étape C — L'injecteur reçoit et traite le message

Le consommateur du storage-service doit :
1. Lire le message du flux avec le groupe `storage-group`.
2. Récupérer les champs texte.
3. Convertir le timestamp en date/heure.
4. Calculer `day` en UTC.
5. Construire la clé primaire Cassandra.
6. Appeler CassandraMeasurementService.
7. Attendre le succès de la persistance.
8. Acquitter le message Redis avec `XACK`.

La commande suivante permet d'inspecter les messages en attente :
```bash
redis-cli -p 6380 XPENDING energy-measurements storage-group
```

Un message en attente n'est pas nécessairement en erreur : il peut être en cours de traitement. En revanche, un message qui reste longtemps en attente doit être examiné.

Redis confirme qu'un message a été acquitté avec `XACK`. Cet acquittement retire son identifiant de la liste des messages en attente du groupe, mais ne supprime pas automatiquement le message du flux.

### Étape D — Cassandra enregistre la mesure

La mesure doit être enregistrée dans la table prévue, par exemple :
```
smartenergy.measurements_by_sensor_day
```

Avec la clé primaire :
```
PRIMARY KEY ((sensor_id, day), measured_at)
```

Pour l'exemple, les valeurs attendues sont :

| Colonne Cassandra | Valeur |
|-------------------|--------|
| sensor_id | SENSOR-001 |
| day | 2026-10-21 |
| measured_at | Timestamp correspondant à 2026-10-21T08:15:00Z |
| power_kw | 3.72 |
| voltage | 226.4 |
| temperature | 29.1 |

Le résultat doit être vérifié avec CQL, par exemple :
```sql
SELECT *
FROM smartenergy.measurements_by_sensor_day
WHERE sensor_id = 'SENSOR-001'
  AND day = '2026-10-21';
```

La requête est adaptée à la clé de partition `(sensor_id, day)`.

## 4. Comportement attendu en cas de panne

| Situation | Comportement attendu |
|----------|----------------------|
| Mesure invalide | HTTP 400 ; aucun événement publié |
| Redis indisponible au moment de la publication | Le Collector ne doit pas répondre 202 comme si la publication avait réussi |
| Cassandra indisponible | Le message n'est pas acquitté avant la persistance |
| Écriture Cassandra réussie | Le consommateur peut acquitter le message |
| ACK Redis échoué après une écriture réussie | Le message peut être retraité ; l'écriture doit être idempotente |
| Message mal formé dans Redis | Journalisation et stratégie explicite de rejet ou de mise en quarantaine |
| Consommateur arrêté puis redémarré | Reprise des messages en attente selon la stratégie configurée |

Il faut aussi prévoir une stratégie de récupération des messages en attente. Ne pas envoyer un ACK en cas d'erreur ne suffit pas, à lui seul, à garantir que tous les messages seront retraités automatiquement.

## 5. Vérifier les ports réellement utilisés

Depuis le terminal Linux ou WSL où les services tournent :

```bash
echo "=== PORTS APPLICATIONS ET BASES ==="
sudo ss -ltnp | grep -E ':(8081|8082|8083|8084|6380|6379|9042|27017)\b' || true
```

Puis tester les connexions :

```bash
echo "=== REDIS ==="
redis-cli -p 6380 PING

echo "=== CASSANDRA ==="
cqlsh localhost 9042 -e "DESCRIBE KEYSPACE smartenergy"

echo "=== MONGODB ==="
mongosh "mongodb://localhost:27017" --quiet \
  --eval 'db.runCommand({ ping: 1 })'
```

Ces tests supposent que les commandes clientes sont installées et que les services sont accessibles depuis cet environnement. Si un service tourne dans Docker, il faut adapter les adresses et les ports.

## 6. Critères de validation finale

L'intégration sera considérée comme fonctionnelle lorsque les tests suivants réussiront :

- [ ] Le Collector accepte une mesure valide et la publie dans Redis.
- [ ] Le message apparaît dans `energy-measurements`.
- [ ] Le consommateur du storage-service lit le message avec `storage-group`.
- [ ] CassandraMeasurementService enregistre la mesure dans Cassandra.
- [ ] La mesure peut être relue par capteur et par jour.
- [ ] L'ACK est exécuté après la réussite de l'écriture.
- [ ] Une panne temporaire de Cassandra ne provoque pas de perte silencieuse du message.
- [ ] Le consommateur reprend les messages en attente.
- [ ] Une nouvelle tentative ne provoque pas de doublon logique.

Le point central : **202 Accepted** confirme l'acceptation asynchrone par le Collector, tandis que la lecture CQL confirme la persistance dans Cassandra. Il faut tester séparément ces deux résultats.

Pour fixer définitivement les ports et les adresses, il reste à confronter cette architecture à ton `docker-compose.yml`, aux fichiers `application.properties` des services et à la configuration Cassandra. Les ports indiqués comme attendus ci-dessus ne remplacent pas cette vérification.
