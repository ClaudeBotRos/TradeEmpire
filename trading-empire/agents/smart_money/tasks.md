# Tâches SMART_MONEY

- Pour chaque symbole de la watchlist (project.md ou liste par défaut BTCUSDT), appeler le connecteur funding (Binance Futures premiumIndex).
- Dériver les signaux (funding positive / negative / neutral) et écrire un fichier par symbole dans `data/signals/smart_money/{symbol}_{timestamp}.json`.
- En cas d’échec API pour un symbole : écrire quand même un fichier avec `low_confidence: true`.
- Vérifier les top traders / vaults Hyperliquid en exécutant `scripts/fetch-hyperliquid-top.js` et en lisant les fichiers dans `data/hyperliquid/` (pas de vue dashboard — usage interne agent uniquement).
