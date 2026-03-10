# Tâches SMART_MONEY

- Pour chaque symbole de la watchlist (project.md ou liste par défaut BTCUSDT), appeler le connecteur funding (Binance Futures premiumIndex).
- Dériver les signaux (funding positive / negative / neutral) et écrire un fichier par symbole dans `data/signals/smart_money/{symbol}_{timestamp}.json`.
- En cas d’échec API pour un symbole : écrire quand même un fichier avec `low_confidence: true`.
- Vérifier les top traders / vaults Hyperliquid en exécutant `scripts/fetch-hyperliquid-top.js` et en lisant les fichiers dans `data/hyperliquid/` (pas de vue dashboard — usage interne agent uniquement).
- **Découverte déléguée** : exécuter `smart-money-discover-wallets.js` puis `smart-money-discover-portfolios.js` (dans run-morning) pour remplir automatiquement les listes de wallets et de portfolio IDs via Apify. Les scripts lisent les seeds (tokens pour Dexscreener) et écrivent `dexscreener_wallets.txt` et `binance_copy_portfolio_ids.txt`. Nécessite `APIFY_API_TOKEN` et, pour les wallets, des tokens dans `dexscreener_seed_tokens.txt` ou `DEXSCREENER_SEED_TOKENS`.
- Exécuter `scripts/dexscreener-top-traders.js` pour récupérer les holders des wallets listés (fichier rempli par la découverte ou manuellement). Exécuter `scripts/binance-copy-leaderboard.js` pour le détail des portfolios (liste remplie par la découverte ou manuellement).
