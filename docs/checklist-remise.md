# Checklist avant remise (sujet, §28)

État au 02/11/2026, branche `develop` (après les PR #24 à #30). Chaque réponse renvoie à une preuve vérifiable dans le dépôt.
Légende : ✅ oui, ⚠️ oui avec réserve, ❌ non, ⏳ à vérifier.

| # | Question du sujet | Réponse | Preuve / commentaire | Action restante |
|---|---|---|---|---|
| 1 | Le projet se compile-t-il sans modification manuelle ? | ✅ | 02/11 : `mvn test` sur les 3 modules → BUILD SUCCESS (analytics-service 72 tests) ; front : `npm install`, `npm test` (5 tests) et `npm run build` OK ; ai-service : 28 tests sur 31 (les 3 échecs demandent Cassandra lancée) | Compilation complète `mvn clean package` depuis un clone neuf avant la remise |
| 2 | Le README explique-t-il clairement le démarrage ? | ✅ | `README.md` (PR #27, 31/10) : prérequis, profils Docker `ai` / `all`, simulateur, front, URL Swagger des 4 services | — |
| 3 | Docker Compose démarre-t-il les dépendances ? | ⚠️ | Bases et scripts d'initialisation : vérifié (`docker compose --profile ai up -d mongo redis cassandra`, 28/10 et 02/11). Plateforme complète avec le front (`docker compose --profile all up -d --build`, front nginx sur 5173 depuis la PR #30) : pas encore vérifiée de bout en bout | Lancer `--profile all` sur un poste propre, ouvrir http://localhost:5173 et consigner le résultat |
| 4 | Le simulateur produit-il des données automatiquement ? | ✅ | Simulateur officiel (README) : `scripts/load/send-measurements.mjs`, P = Pbase + A·sin(2πt/T) + bruit, anomalies avec `--spike`, débit, durée et nombre de capteurs réglables (`--rate`, `--duration`, `--sensors`) | Test du sujet §10.2 (5 capteurs, 2 min) : `docs/tests.md` S1, à exécuter |
| 5 | Les requêtes invalides sont-elles rejetées correctement ? | ✅ | `docs/tests.md` n° 2 : mesure sans `sensorId` → HTTP 400 avec détail ; 8 tests unitaires de validation du DTO ; compteurs `energy.measurements` `rejected_validation` / `rejected_format` | — |
| 6 | Les messages sont-ils visibles dans Redis ? | ✅ | `docs/tests.md` n° 1 et n° 5 : `XLEN`, `XINFO GROUPS` (lag), `XPENDING` sur `energy-measurements` / `storage-group` | — |
| 7 | Les mesures sont-elles persistées dans Cassandra ? | ✅ | `docs/tests.md` n° 1, n° 3, n° 6, P1 (persistance après `docker compose restart`), P3 (doublon : une seule ligne) | — |
| 8 | Les capteurs et agrégats sont-ils disponibles dans MongoDB ? | ✅ | Capteurs : `scripts/init-mongo.js`, `GET /api/sensors` (écran Capteurs du front). Agrégats : `docs/tests.md` I1 (29/10) : `POST /api/sensors/{id}/daily-summary/compute` enregistre le résumé dans `daily_summaries`, relu à l'identique par `GET /api/sensors/{id}/daily-summary`, cohérent avec l'analyse et rejouable | — |
| 9 | L'API permet-elle de lire l'historique ? | ✅ | `GET /api/measurements/{sensorId}?from&to` (Analytics) ; `docs/tests.md` n° 3 : liste ordonnée, plus récente d'abord ; écran Historique du front | — |
| 10 | Les résultats analytiques sont-ils vérifiables ? | ✅ | `docs/tests.md` n° 4 : pic de 12,5 kW, valeurs attendues calculées à la main puis obtenues (moyenne, énergie, z = 4,79, +247 %) ; formules et limites dans `docs/analytics.md` ; 67 tests unitaires | — |
| 11 | Les principaux scénarios de panne ont-ils été testés ? | ✅ | `docs/tests.md` : arrêt du Storage (n° 5, n° 6), panne de Cassandra (P2, C7, C8 validé après correctif le 27/10), redémarrage complet (P1) ; montée en charge jusqu'à 100 mesures/s (`docs/monitoring.md`) | — |
| 12 | Les secrets sont-ils absents du dépôt ? | ⚠️ | Aucun `.env` réel commité (historique vérifié le 02/11) ; `.env` ignoré par Git. Mais `.env.example` contient un secret JWT et des mots de passe utilisables tels quels (`admin123`, `viewer123`). Note : `docs/securite.md` | Remplacer les valeurs de `.env.example` par des valeurs factices |
| 13 | Swagger est-il accessible ? | ✅ | Vérifié le 29/10 : Collector `http://localhost:8081/swagger-ui.html`, Storage `http://localhost:8082/swagger-ui/index.html`, Analytics `http://localhost:8083/swagger-ui/index.html` (avec `/api/auth` depuis la PR #24), ai-service `http://localhost:8085/docs` ; URL listées dans le README | — |
| 14 | Le groupe sait-il expliquer ses choix sans lire le rapport ? | ⏳ | Non vérifiable par le dépôt | Répétition de la soutenance : chacun présente l'architecture complète, pas seulement sa partie (sujet §24) |

## Synthèse

- ✅ 11 questions (1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13) sur 14 ; ⚠️ 2 (3, 12) ; ⏳ 1 (14).
- **À compléter avant la remise** : lancement complet `--profile all` (3), valeurs factices dans `.env.example` (12),
  test §10.2 du simulateur, répétition orale (14).

## Autres points relevés pendant la vérification

- storage-service n'a aucun test unitaire et n'expose pas Actuator (sujet Étape 11 : « chaque service Spring Boot
  doit activer Actuator »).
- Débit du Storage : le plafond de 65-70 mesures/s mesuré le 29/10 (`docs/monitoring.md`) a été corrigé le 30/10
  (le flux Redis est vidé lot par lot à chaque cycle) ; l'expérience de charge est à rejouer pour le confirmer.
- Les ports des bases (27018, 6380, 9042) sont exposés par `docker-compose.yml` : normal en développement, signalé
  dans `docs/securite.md`.
- Fichiers parasites (`l.localhost…`, `application.properties.bak`, `commit_*.txt`) supprimés (PR #26 et #30).
