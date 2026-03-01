# Trading Empire — Application

Système multi-agents pour idées de trades crypto (voir [PRD](../PRD.md)).

## MVP + Phase 2 (flux V1)

- **Séquence matin complète** (TECHNICALS → SMART_MONEY → SENTIMENT → ORCHESTRATOR → RISK_JOURNAL) :
  ```bash
  cd .../trading-empire && node scripts/run-morning.js
  ```
  Produit : signaux, idées, décisions, journal `data/journal/{date}.md`. Puis `node scripts/morning-brief.js` pour le brief (écrit aussi `data/journal/{date}_brief.md`) — le cron 08:15 envoie ce brief sur WhatsApp (canal unique).
- **Soir (20:30)** : cron `tradeempire-evening` exécute `risk-journal-scan.js` pour mettre à jour le journal.
- **Dashboard (permanent)** : le service systemd utilisateur `tradeempire-dashboard` garde le dashboard actif. URL : **http://127.0.0.1:3580**.  
  - Démarrer / activer en permanent : `./scripts/dashboard-service.sh start` (ou `systemctl --user enable --now tradeempire-dashboard`).  
  - Arrêter : `./scripts/dashboard-service.sh stop`.  
  - Statut : `./scripts/dashboard-service.sh status`.  
  - Pour que le dashboard redémarre après reboot sans session ouverte : `./scripts/dashboard-service.sh enable-linger`.  
  - Lancement manuel (sans service) : `node scripts/dashboard-server.js [PORT]` (défaut 3579).
- **Scripts individuels** : `technicals-scan.js`, `smart-money-scan.js`, `sentiment-scan.js`, `orchestrator-scan.js`, `risk-journal-scan.js`, `morning-brief.js` (brief du jour pour notification), `agent-status-report.js` (rapport de situation : compétences + connexions API par agent, sortie dans `data/dashboard/agent_status_report.json` et `data/reports/` ; option `--light` pour tester uniquement les APIs sans exécuter les scripts).
- **Tester chaque agent** : `node scripts/test-agents.js` (tous), `node scripts/test-agents.js --full` (intégration run-morning + Wire), ou `node scripts/test-agents.js technicals sentiment` (un ou plusieurs). Voir [docs/TEST_AGENTS.md](docs/TEST_AGENTS.md).

## Structure

- `rules/` — Règles risk, stratégie, exécution (lues par les agents).
- `data/signals/technicals/` — Signaux produits par TECHNICALS.
- `scripts/` — Outils (fetch OHLCV, technicals-scan, dashboard-server).
- `dashboard/` — Dashboard minimal (squelette + module Signaux techniques). Servi par `scripts/dashboard-server.js`.
- `agents/` — Définitions des agents (V1).

## Références

- [PRD](../PRD.md)
- [Technical Design](../TECHNICAL_DESIGN.md)
- [Backlog](../BACKLOG.md)
