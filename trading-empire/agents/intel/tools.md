# Outils Intel (Daphnée)

- `scripts/intel-scan.js` : script principal. Appelle l’API X (X_BEARER_TOKEN), recherche YouTube via YouTube Data API v3 (YOUTUBE_API_KEY), invoque la skill youtube-watcher pour les transcripts, produit les Trend Cards et écrit `data/dashboard/intel/trend_cards.json`. Lit aussi `economic_calendar.json` pour ajouter une carte Macro si des événements clés sont prévus ou viennent d’être publiés.
- `scripts/economic-calendar-scan.js` : lit le calendrier économique (investing.com), enregistre les événements clés (date, heure UTC, pays, libellé, importance, forecast, previous) dans `data/dashboard/intel/economic_calendar.json` ; après l’heure de publication, met à jour avec `actual` quand disponible (re-scrape ou source secondaire). À lancer en cron (ex. matin + après clôture US) ou avant intel-scan.
- **X** : Twitter API v2 search recent (crypto, bitcoin). Même token que SENTIMENT_X.
- **YouTube Data API v3** : recherche automatique de vidéos (requête « crypto bitcoin news », YOUTUBE_API_KEY ou GOOGLE_API_KEY dans workspace/.env). Si pas de clé : fallback sur `dashboard/config/intel_youtube_urls.json`.
- **YouTube (youtube-watcher)** : skill OpenClaw pour le transcript (get_transcript.py, yt-dlp).
- **Calendrier économique** : source réelle = **JBlanked API** (si `JBLANKED_API_KEY` dans .env) — calendrier Forex Factory, 1 req/jour gratuite. investing.com n’est pas utilisable (API 404, page Cloudflare). Sinon fallback = `dashboard/config/economic_calendar_events.json` (saisie manuelle). Données dans `data/dashboard/intel/economic_calendar.json`.
