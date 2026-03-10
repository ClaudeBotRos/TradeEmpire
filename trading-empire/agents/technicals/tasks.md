# Tâches TECHNICALS

- Lire la watchlist (project.md).
- Pour chaque symbole/timeframe configuré : appeler le connecteur OHLCV, calculer trend/levels/volatility, écrire le fichier signal dans data/signals/technicals/.
- Optionnel : exécuter `tradingview-events-calendar.js` pour récupérer le calendrier d’événements par symbole (TradingView RapidAPI) et écrire `tradingview_events_calendar.json` dans data/signals/technicals/ (utilisable par l’orchestrateur ou le dashboard pour afficher les events liés à chaque actif).
- Optionnel : exécuter `crypto-indicators-rapidapi.js` pour récupérer RSI, MACD, EMA par symbole (Crypto Trading Indicators RapidAPI) et écrire `crypto_indicators_rapidapi.json` (utilisable par le dashboard et l’orchestrateur pour signaux techniques complémentaires).
