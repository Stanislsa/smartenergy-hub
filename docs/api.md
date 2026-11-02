# Contrat de données : SmartEnergy Hub

## Flux Redis

| Élément | Valeur |
|---|---|
| Stream | `energy-measurements` |
| Consumer group | `storage-group` |
| Redis (local) | `localhost:6380` |

Tous les champs sont stockés dans Redis sous forme de **texte**.

## Mesure (JSON envoyé au Collector)

```json
{
  "sensorId": "SENSOR-001",
  "timestamp": "2026-09-30T08:15:00Z",
  "powerKw": 3.72,
  "voltage": 226.4,
  "current": 16.4,
  "frequency": 50.0,
  "temperature": 29.1
}
```

| Champ | Type | Obligatoire | Règle |
|---|---|---|---|
| `sensorId` | texte | oui | non vide |
| `timestamp` | texte ISO 8601 UTC | oui | de 365 jours dans le passé à 5 minutes dans le futur |
| `powerKw` | nombre | oui | de 0 à 1000 |
| `voltage` | nombre | oui | de 0 à 500 |
| `current` | nombre | non | de 0 à 2000 |
| `frequency` | nombre | non | de 40 à 70 |
| `temperature` | nombre | non | de -50 à 100 |

Les bornes servent à écarter les valeurs absurdes (capteur défectueux, donnée corrompue), pas à détecter
une consommation anormale : une puissance de 12,5 kW sur un capteur limité à 8 kW est valide et sera signalée
comme anomalie par l'Analytics.

## Endpoint

`POST http://localhost:8081/api/measurements` (documentation Swagger : `http://localhost:8081/swagger-ui.html`)

| Cas | Code HTTP | Effet |
|---|---|---|
| Mesure valide | **202 Accepted** | événement publié dans Redis |
| Mesure invalide (règle violée, JSON illisible) | **400 Bad Request** | message d'erreur, rien dans Redis |
| Redis indisponible | **503 Service Unavailable** | la mesure n'est pas publiée, l'émetteur peut réessayer |

Exemple de réponse 400 :

```json
{
  "status": 400,
  "error": "Validation failed",
  "details": ["sensorId : ne doit pas être vide"]
}
```

## Champs d'un événement dans le stream Redis

Toujours présents : `sensorId`, `timestamp`, `powerKw`, `voltage`.

Facultatifs : `current`, `frequency`, `temperature`. Ils sont **absents de l'événement** s'ils n'ont pas été
envoyés : le Storage doit prévoir qu'ils peuvent manquer.

## Métriques du Collector (Actuator)

| Métrique | Tag `outcome` | Signification |
|---|---|---|
| `energy.measurements` | `accepted` | mesure publiée dans Redis (202) |
| `energy.measurements` | `rejected_validation` | règle de validation violée (400) |
| `energy.measurements` | `rejected_format` | JSON illisible (400) |
| `energy.measurements` | `error_redis` | Redis indisponible (503) |
| `energy.measurements.publish` | | temps de publication dans Redis |

Consultation : `GET http://localhost:8081/actuator/metrics/energy.measurements?tag=outcome:accepted`

## Décisions de conception (questions du sujet, §9.3)

**Pourquoi un horodatage UTC ?** Les capteurs et les services peuvent se trouver dans des fuseaux différents
(ou changer d'heure d'été). Un format unique (ISO 8601 avec `Z`) évite les ambiguïtés. Le Storage calcule aussi
le jour de la clé de partition Cassandra en UTC, ce qui rend une même mesure toujours rattachée à la même partition.

**Que faire d'une mesure envoyée deux fois ?** Elle est acceptée (202) et publiée deux fois dans Redis. Le Storage
écrit avec la clé primaire `((sensor_id, day), measured_at)` : la seconde écriture remplace la première, sans
doublon logique (scénario P3 de `docs/tests.md`). Le Collector ne garde pas d'état.

**Faut-il accepter une mesure très ancienne ?** Oui, dans une limite : un capteur resté hors ligne rattrape son
retard (le script `send-measurements.mjs --backfill-hours` fait la même chose). Au-delà de 365 jours dans le
passé ou de 5 minutes dans le futur (horloge déréglée), la mesure est rejetée en 400.

**Erreur de format ou anomalie énergétique ?** Une erreur de format (champ manquant, valeur hors plage, JSON
illisible) est rejetée par le Collector et n'entre jamais dans Redis : compteurs `rejected_validation` et
`rejected_format`. Une anomalie énergétique est une mesure correcte mais inhabituelle (pic de puissance) : elle
est acceptée, stockée, puis détectée par l'Analytics (seuil, z-score, variation).