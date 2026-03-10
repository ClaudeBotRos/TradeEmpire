# Outils Yield Farmer

- **Lecture** : `data/dashboard/yield_farmer_report.json` (état des pools, APY, capital alloué), `data/dashboard/uniswap_v3_arbitrum_pools.json` (meilleurs pools Arbitrum — top TVL, stables sans IL, stablecoins ; généré par `yield-fetch-pools-arbitrum.js`), `data/dashboard/executor_balance.json` ou `tibo_report.json` (capital disponible / dormant), `docs/PLAN_YIELD_FARMING.md` (plan et objectifs), `docs/MEILLEURS_POOLS_ARBITRUM.md` (résumé des pools Arbitrum), `rules/risk_rules.md` (plafonds).
- **Écriture** : `data/dashboard/yield_farmer_report.json` (rapport de scan, APY, alertes, recommandations), `data/dashboard/agent_profit_suggestions.json` (suggestions de rendement pour le BOSS).
- **Scripts** (à appeler depuis la racine du workspace `~/.openclaw/workspace`) :
  - `node TradeEmpire/trading-empire/scripts/yield-fetch-pools-arbitrum.js` — récupère les meilleurs pools Uniswap V3 sur Arbitrum (DeFiLlama) et écrit `data/dashboard/uniswap_v3_arbitrum_pools.json` (top par TVL, stables sans IL, stablecoins). À lancer pour actualiser la liste des pools avant analyse ou rapport.
  - `node TradeEmpire/trading-empire/scripts/yield-scan.js` — scan des pools (APY, TVL) et mise à jour du rapport (à créer selon plan).
  - `node TradeEmpire/trading-empire/scripts/yield-report.js` — synthèse quotidienne (capital, rendement, alertes).
- **Alertes** : `node TradeEmpire/trading-empire/scripts/notify-user-whatsapp.js` pour notifier l’utilisateur en cas d’APY < 5 % ou risque détecté (message dans `data/notifications/whatsapp_pending.json`).
- **Pas d’exécution on-chain** sans validation : le Yield Farmer recommande ; les dépôts/retraits réels sur les protocoles sont faits par l’utilisateur ou par un module d’exécution validé.
