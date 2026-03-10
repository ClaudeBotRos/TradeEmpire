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

Sans clé API : le script utilise le package npm **youtube-search-api** puis éventuellement RapidAPI ou **intel_youtube_urls.json** (fallback manuel).

## Filtrage Daphnée (placement crypto uniquement)

Après récupération du transcript, Daphnée classe chaque vidéo en **utile** (borderline) ou **rejeté** (placement crypto ou contenu insuffisant). **Un lien d’affiliation ou un code promo (exchange, app, code type HOLY) ne suffit pas à rejeter** — on rejette seulement quand la vidéo pousse une crypto/token (ex. « buy this coin », « next 100x »). Les cartes « rejeté » vont dans « Vidéos écartées » (vue Intel).

Pour personnaliser : copier **intel_youtube_filter.example.json** en **intel_youtube_filter.json** et modifier :
- **shill_phrases** : phrases qui indiquent un **placement crypto** (pousser un actif précis), pas les promos génériques.
- **min_transcript_length** : en dessous de ce nombre de caractères, la vidéo est marquée « rejeté » (contenu insuffisant).
