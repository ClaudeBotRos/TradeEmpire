# Outils SMART_MONEY

- `scripts/fetch-funding.js` : récupération du funding rate (et mark price) Binance USDT-M Futures (API publique).
- `scripts/smart-money-scan.js` : scan de la watchlist → écriture des signaux dans `data/signals/smart_money/`.
- `scripts/fetch-hyperliquid-top.js` : récupération des top performers Hyperliquid (leading vaults) → écriture dans `data/hyperliquid/leading_vaults_<timestamp>.json`. À utiliser par l’agent pour vérifier les top traders / vaults HL (pas de vue dashboard).
- **Découverte (délégation à l’agent)** : `scripts/smart-money-discover-wallets.js` remplit `dexscreener_wallets.txt` via Apify (acteur Dexscreener Top Traders) à partir de tokens seeds (`dexscreener_seed_tokens.txt` ou `DEXSCREENER_SEED_TOKENS`). `scripts/smart-money-discover-portfolios.js` remplit `binance_copy_portfolio_ids.txt` via Apify (acteur Binance Copy Trading Scraper, mode leaderboard). Requièrent `APIFY_API_TOKEN`. Exécutés en amont dans run-morning.
- `scripts/dexscreener-top-traders.js` : récupération des holders (top traders) Dexscreener via RapidAPI pour les wallets listés dans `dexscreener_wallets.txt` (ou env). Sortie : `dexscreener_holders.json`.
- `scripts/binance-copy-leaderboard.js` : détail de portfolios Binance Copy (RapidAPI lead-portfolio) à partir de `binance_copy_portfolio_ids.txt` (ou env). Sortie : `binance_copy_leaderboard.json`.
