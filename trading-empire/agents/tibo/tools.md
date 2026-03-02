# Outils Tibo

- **Executor** : `node TradeEmpire/trading-empire/scripts/executor-run.js` (depuis la racine du workspace). Lit `data/decisions/*_APPROVED.json`, `data/ideas/`, `data/dashboard/execution_config.json`. Place les ordres sur ASTER, enregistre les pending TP dans `data/dashboard/executor_pending_tp.json` et les ordres exécutés dans `data/dashboard/executed_orders.json`.
- **Scrutator** : le cron appelle `run-tp-scrutator-if-needed.js` (lance `executor-tp-scrutator.js` seulement s'il y a des TP en attente). Lit `data/dashboard/executor_pending_tp.json`, interroge ASTER (statut des ordres d’entrée), place les TP quand FILLED, met à jour `executed_orders.json` (tp_order_id) et retire les niveaux traités des pending.
- **Rapport** : `node TradeEmpire/trading-empire/scripts/tibo-report.js` met à jour `data/dashboard/tibo_report.json` (dernier run executor/scrutator, solde, ordres du jour, pending TP, erreurs). Ce fichier est lu par le BOSS et par Chase pour le post-mortem.
