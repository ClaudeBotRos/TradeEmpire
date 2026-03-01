# Outils SMART_MONEY

- `scripts/fetch-funding.js` : récupération du funding rate (et mark price) Binance USDT-M Futures (API publique).
- `scripts/smart-money-scan.js` : scan de la watchlist → écriture des signaux dans `data/signals/smart_money/`.
- `scripts/fetch-hyperliquid-top.js` : récupération des top performers Hyperliquid (leading vaults) → écriture dans `data/hyperliquid/leading_vaults_<timestamp>.json`. À utiliser par l’agent pour vérifier les top traders / vaults HL (pas de vue dashboard).
