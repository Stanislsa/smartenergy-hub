# Frontend SmartEnergy Hub (partie D)

Interface web React + Vite qui affiche les données des services existants.
Aucune logique métier n'est recalculée dans le navigateur : énergie, anomalies et prévisions
viennent des API d'`analytics-service` et d'`ai-service`.

## Lancement (développement)

Prérequis : Node.js 18 ou plus, et les services démarrés (Collector 8081, Storage 8082,
Analytics 8083 ; ai-service 8085 pour l'écran Prévision).

```cmd
cd frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173.

### Appels aux API et CORS

En développement, le navigateur appelle uniquement Vite (port 5173), qui relaie les requêtes
vers les services (`vite.config.js`). Il n'y a donc **aucune configuration CORS à ajouter**
dans les services Spring Boot pour travailler en local.

| Préfixe appelé par le front | Relayé vers |
|---|---|
| `/api/...` | analytics-service `http://localhost:8083/api/...` |
| `/ai/api/v1/...` | ai-service `http://localhost:8085/api/v1/...` |
| `/svc/<service>/health` | `/health` du Collector, du Storage, de l'Analytics ou de l'IA |

Les adresses peuvent être changées sans modifier le code, avec les variables
`COLLECTOR_URL`, `STORAGE_URL`, `ANALYTICS_URL`, `AI_URL` (fichier `frontend/.env.local`).

Pour un déploiement hors de Vite (build statique), il faudra soit un reverse proxy avec les
mêmes préfixes, soit configurer CORS dans les services pour l'origine du front
(décision d'équipe, voir les recommandations).

## Données affichées

Le front affiche uniquement les données renvoyées par les API (MongoDB, Cassandra, calculs de l'Analytics).
Pour alimenter Cassandra en continu par la vraie chaîne (Collector → Redis → Storage → Cassandra),
lancer depuis la racine du dépôt : `node scripts/load/send-measurements.mjs` (voir `scripts/load/README.md`).

## Écrans et API utilisées

| Écran | API |
|---|---|
| Tableau de bord | `GET /api/sensors`, `GET /api/measurements/{id}/latest`, `GET /api/measurements/{id}` (24 h), `GET /api/analytics/{id}/anomalies/all` (24 h), `/health` des services |
| Capteurs | `GET /api/sensors`, `GET /api/measurements/{id}/latest`, `POST /api/sensors` (ajout) |
| Historique | `GET /api/measurements/{id}?from&to&limit` (31 jours max) |
| Anomalies | `GET /api/analytics/{id}/anomalies/all?from&to` |
| Résumé quotidien | `GET /api/sensors/{id}/daily-summary?date`, sinon `GET /api/analytics/{id}/summary` + `anomalies/all` sur la journée UTC |
| Prévision | `POST /api/v1/forecasts/predict` (ai-service, un appel par horizon), `GET /api/v1/model/status` |

## Choix et limites

- **Indicateurs du tableau de bord** : puissance totale = somme des dernières mesures des capteurs
  actifs ; tension et température = moyennes des dernières mesures.
- **Répartition par bâtiment** : les capteurs n'ont pas de champ « type » dans MongoDB, la
  répartition utilise le champ `building`.
- **État des services** : Collector, Storage, Analytics et IA via leur `/health` ; MongoDB et Cassandra
  déduits d'une lecture réussie (`/api/sensors`, `/api/measurements/.../latest`). Redis n'expose rien
  au navigateur : il n'est pas affiché.
- **Anomalies** : l'API ne renvoie pas de niveau de gravité ; l'écran affiche la méthode de détection,
  la valeur observée, le seuil et une explication construite à partir de ces champs.
- **Prévision** : le service IA renvoie un point par appel ; la courbe est construite avec 6 horizons.
  Si le modèle n'est pas entraîné (HTTP 503), l'écran l'indique.
- **Dates** : les périodes sont en jours UTC, comme le partitionnement Cassandra.
