# Checklist avant remise (sujet, §28)

État au 29/10/2026, branche `develop`. Chaque réponse renvoie à une preuve vérifiable dans le dépôt.
Légende : ✅ oui, ⚠️ oui avec réserve, ❌ non, ⏳ à vérifier.

| # | Question du sujet | Réponse | Preuve / commentaire | Action restante |
|---|---|---|---|---|
| 1 | Le projet se compile-t-il sans modification manuelle ? | ✅ | Maven (`mvn`) : analytics-service 67 tests ✅, collector-service 11 tests ✅ (`docs/tests.md` §6) ; storage-service démarre (`spring-boot:run`) ; front : `npm install` + `npm run build` OK | Faire une compilation complète `mvn clean package` depuis un clone neuf avant la remise |
| 2 | Le README explique-t-il clairement le démarrage ? | ❌ | `README.md` annonce le front « à venir » ; `docker compose up -d` ne démarre plus rien depuis l'ajout des profils (`--profile ai` / `--profile all` nécessaires) ; scripts `scripts/load/` absents | Mettre à jour le README (front, profils Docker, scripts) |
| 3 | Docker Compose démarre-t-il les dépendances ? | ⚠️ | `docker-compose.yml` : MongoDB, Redis, Cassandra, scripts d'initialisation, 3 services Java, ai-service. Démarrage vérifié le 28/10 avec `docker compose --profile ai up -d mongo redis cassandra` | Documenter les profils (`ai`, `all`) |
| 4 | Le simulateur produit-il des données automatiquement ? | ⚠️ | `simulator/energy_simulator.py` affiche des mesures mais ne les envoie pas au Collector (champs `device_id`/`power_kw`, capteurs absents de MongoDB). Production automatique assurée par `scripts/load/send-measurements.mjs` (mesures envoyées au Collector pour les capteurs actifs de MongoDB, débit réglable) | Décider en groupe : corriger `simulator/` ou présenter `send-measurements.mjs` comme simulateur |
| 5 | Les requêtes invalides sont-elles rejetées correctement ? | ✅ | `docs/tests.md` n° 2 : mesure sans `sensorId` → HTTP 400 avec détail ; 8 tests unitaires de validation du DTO ; compteurs `energy.measurements` `rejected_validation` / `rejected_format` | — |
| 6 | Les messages sont-ils visibles dans Redis ? | ✅ | `docs/tests.md` n° 1 et n° 5 : `XLEN`, `XINFO GROUPS` (lag), `XPENDING` sur `energy-measurements` / `storage-group` | — |
| 7 | Les mesures sont-elles persistées dans Cassandra ? | ✅ | `docs/tests.md` n° 1, n° 3, n° 6, P1 (persistance après `docker compose restart`), P3 (doublon : une seule ligne) | — |
| 8 | Les capteurs et agrégats sont-ils disponibles dans MongoDB ? | ✅ | Capteurs : `scripts/init-mongo.js`, `GET /api/sensors` (écran Capteurs du front). Agrégats : `docs/tests.md` I1 (29/10) : `POST /api/sensors/{id}/daily-summary/compute` enregistre le résumé dans `daily_summaries`, relu à l'identique par `GET /api/sensors/{id}/daily-summary`, cohérent avec l'analyse et rejouable | — |
| 9 | L'API permet-elle de lire l'historique ? | ✅ | `GET /api/measurements/{sensorId}?from&to` (Analytics) ; `docs/tests.md` n° 3 : liste ordonnée, plus récente d'abord ; écran Historique du front | — |
| 10 | Les résultats analytiques sont-ils vérifiables ? | ✅ | `docs/tests.md` n° 4 : pic de 12,5 kW, valeurs attendues calculées à la main puis obtenues (moyenne, énergie, z = 4,79, +247 %) ; formules et limites dans `docs/analytics.md` ; 67 tests unitaires | — |
| 11 | Les principaux scénarios de panne ont-ils été testés ? | ✅ | `docs/tests.md` : arrêt du Storage (n° 5, n° 6), panne de Cassandra (P2, C7, C8 validé après correctif le 27/10), redémarrage complet (P1) ; montée en charge jusqu'à 100 mesures/s (`docs/monitoring.md`) | — |
| 12 | Les secrets sont-ils absents du dépôt ? | ✅ | Aucun mot de passe, jeton ou clé dans le code, la configuration ni l'historique Git complet (vérifié le 29/10) ; `.env` ignoré par Git ; note de sécurité : `docs/securite.md` (secrets à protéger, accès exposés, mécanismes, risques) | Appliquer en production les recommandations de `docs/securite.md` §5 |
| 13 | Swagger est-il accessible ? | ✅ | Vérifié le 29/10 : Collector `http://localhost:8081/swagger-ui.html` (3 endpoints), Storage `http://localhost:8082/swagger-ui/index.html` (5), Analytics `http://localhost:8083/swagger-ui/index.html` (11) ; contrats OpenAPI 3 sur `/v3/api-docs` | Ajouter l'URL du Storage au README |
| 14 | Le groupe sait-il expliquer ses choix sans lire le rapport ? | ⏳ | Non vérifiable par le dépôt | Répétition de la soutenance : chacun présente l'architecture complète, pas seulement sa partie (sujet §24) |

## Synthèse

- ✅ 10 questions (1, 5, 6, 7, 8, 9, 10, 11, 12, 13) ; ⚠️ 2 (3, 4) ; ❌ 1 (2) ; ⏳ 1 (14).
- **À compléter avant la remise** : README (2), simulateur (4), répétition orale (14).

## Autres points relevés pendant la vérification

- Fichiers parasites versionnés : `l.localhostUbuntuhomeadrianoprojetssmartenergy-hub'` (racine) et
  `storage-service/src/main/resources/application.properties.bak`.
- storage-service n'a aucun test unitaire ; son débit plafonne vers 65-70 mesures/s depuis le correctif C8
  (`docs/monitoring.md`, point 7).
- Les ports des bases (27018, 6380, 9042) sont exposés par `docker-compose.yml` : normal en développement, à signaler
  dans la note de sécurité (`docs/securite.md`, sujet Étape 12 : « ne pas exposer inutilement les ports des bases en production »).
