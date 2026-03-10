# Outils Recovery Analyst

- **Lecture** : `data/tracker/outcomes/*.json`, `data/decisions/*_APPROVED.json`, `*_REVOKED.json`, `executed_orders.json`, `data/signals/technicals/`, `scout_proposals.json`, `data/ideas/*.json`.
- **Script outcomes** : `node scripts/recovery-analyst-report.js [--md]` — agrège outcomes Chase, écrit `recovery_report.json`.
- **Script revue intraday** : `node scripts/recovery-intraday-review.js [--md] [--apply-cancel]` — lit les **ordres ouverts sur ASTER** (getOpenOrders), ne traite que les ordres d’entrée (LIMIT) ; réévaluation vs trend → keep/cancel ; écrit `recovery_intraday_report.json`. Avec `--apply-cancel` annule sur ASTER les ordres recommandés cancel.
- **Écriture** : rapports ; REVOKED uniquement si `--apply-revoked`. Pas de modification des outcomes ni des idées.
