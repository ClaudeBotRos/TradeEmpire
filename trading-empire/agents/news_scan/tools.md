# Outils NEWS_SCAN

- **Script principal** : `scripts/news-scan.js` — priorité : 1) JSON externe optionnel (external_aggregate_path) 2) agrégat RSS (config) 3) CryptoDaily RapidAPI. Coindesk + X trending. Autonome, ne dépend d'aucun autre repo.
- **Config RSS** : `dashboard/config/news_rss_feeds.json` — `use_rss_first`, `min_items_to_skip_api`, `external_aggregate_path`, liste `feeds` (name, url). Si assez d'items RSS, aucun appel API CryptoDaily.
- **JSON externe** (optionnel) : `external_aggregate_path` dans la config ou env `NEWS_AGGREGATE_JSON` → fichier avec `items: [{ title, url, date?, source? }]`. Utilisé s'il a moins de 2 h.
- **Lecture** : cryptodaily_news.json (secours), trend_cards.json (X), config RSS.
- **Écriture** : `news_scan_report.json` (source, cryptodaily, coindesk, rss_aggregate?, x_trending, catalysts).
- **APIs** : CryptoDaily (RapidAPI) uniquement en secours si RSS insuffisant.
