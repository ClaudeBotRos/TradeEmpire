# Intel (Daphnée) — configuration

## Recherche YouTube automatique

Pour que Daphnée **cherche elle-même les vidéos** sur YouTube (sans remplir manuellement des URLs) :

1. Créer une clé API **YouTube Data API v3** (Google Cloud Console).
2. Ajouter dans **workspace/.env** (ou `~/.openclaw/workspace/.env`) :
   ```bash
   YOUTUBE_API_KEY=votre_cle_ici
   ```
   Ou utiliser une clé Google existante : `GOOGLE_API_KEY=votre_cle_ici`

3. Lancer `node scripts/intel-scan.js` : le script recherche alors les vidéos avec la requête « crypto bitcoin news » (5 résultats), récupère le transcript si le skill youtube-watcher est disponible, et crée les Trend Cards.

Sans clé API : le script utilise uniquement les URLs listées dans **intel_youtube_urls.json** (fallback manuel).
