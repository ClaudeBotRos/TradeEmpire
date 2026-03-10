# Tâches NEWS_SCAN

1. **CryptoDaily** : s’appuyer sur `cryptodaily-news.js` (ou lire `data/dashboard/intel/cryptodaily_news.json`) pour inclure les actualités crypto du jour.
2. **Coindesk** : récupérer les derniers articles (RSS ou API) et en extraire titres + URLs pour les ajouter au rapport.
3. **X trending** : réutiliser les tendances X (recherche recent crypto/bitcoin) via le cache ou l’API, et les résumer en thèmes/catalysts.
4. **Rapport** : écrire `data/dashboard/intel/news_scan_report.json` avec `{ timestamp_utc, cryptodaily, coindesk, x_trending, catalysts }` pour que SENTIMENT_X et Intel puissent s’en servir.
