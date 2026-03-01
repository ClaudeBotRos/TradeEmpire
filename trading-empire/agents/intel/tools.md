# Outils Intel (Daphnée)

- `scripts/intel-scan.js` : script principal. Appelle l’API X (X_BEARER_TOKEN), lit `dashboard/config/intel_youtube_urls.json` (URLs des vidéos crypto du jour), invoque la skill youtube-watcher pour les transcripts, produit les Trend Cards et écrit `data/dashboard/intel/trend_cards.json`.
- **X** : Twitter API v2 search recent (crypto, bitcoin). Même token que SENTIMENT_X.
- **YouTube** : skill OpenClaw `youtube-watcher` (script Python get_transcript.py, yt-dlp). Liste d’URLs dans `dashboard/config/intel_youtube_urls.json`.
