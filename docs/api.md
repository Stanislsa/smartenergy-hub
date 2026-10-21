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
  "temperature": 29.1
}
```

| Champ | Type | Obligatoire | Règle |
|---|---|---|---|
| `sensorId` | texte | oui | non vide |
| `timestamp` | texte ISO 8601 UTC | oui | ex. `2026-09-30T08:15:00Z` |
| `powerKw` | nombre | oui | supérieur ou égal à 0 |
| `voltage` | nombre | oui | supérieur ou égal à 0 |
| `temperature` | nombre | non | aucune contrainte |

## Endpoint

`POST http://localhost:8081/api/measurements`

| Cas | Code HTTP | Effet |
|---|---|---|
| Mesure valide | **202 Accepted** | événement publié dans Redis |
| Mesure invalide | **400 Bad Request** | message d'erreur, rien dans Redis |

Exemple de réponse 400 :

```json
{
  "status": 400,
  "error": "Validation failed",
  "details": ["sensorId: ne doit pas être vide"]
}
```

## Champs d'un événement dans le stream Redis

`sensorId`, `timestamp`, `powerKw`, `voltage`, `temperature`

(Si `temperature` est absente, la valeur est `null` en texte.)