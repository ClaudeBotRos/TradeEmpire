# Outils TECHNICALS

- `scripts/fetch-ohlcv.js` : récupération klines Binance.
- `scripts/technicals-scan.js` : scan complet → fichier signal JSON (data/signals/technicals/).
- `scripts/tradingview-events-calendar.js` : calendrier d’événements par symbole (TradingView via RapidAPI). Endpoint : `GET https://tradingview18.p.rapidapi.com/symbols/get-events-calendar?symbol=XXX`. Utilise `RAPIDAPI_KEY` (workspace/.env). Symboles = watchlist (data/dashboard/watchlist.json). Sortie : `data/signals/technicals/tradingview_events_calendar.json` (by_symbol, last_updated_utc, source).
- `scripts/crypto-indicators-rapidapi.js` : indicateurs RSI, MACD, EMA (Crypto Trading Indicators API sur RapidAPI). Host : `crypto-technical-analysis-indicator-apis-for-trading.p.rapidapi.com`. Endpoints : `/rsi`, `/macd`, `/ema` (params : symbol, timeframe=4h, length=14 pour RSI/EMA). Utilise `RAPIDAPI_KEY`. Sortie : `data/signals/technicals/crypto_indicators_rapidapi.json` (by_symbol avec rsi, macd, ema par symbole).
