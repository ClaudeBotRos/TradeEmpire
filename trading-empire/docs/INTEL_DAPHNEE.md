# Intel — Daphnée (Trend Cards)

Agent **Daphnée** documente le module OpenClaw Intel avec des **Trend Cards** issues de :

1. **X (Twitter)** : dernières tendances crypto/bitcoin (API v2 search recent), thèmes dérivés (ETF, bullish/bearish, halving, régulation, DeFi, etc.).
2. **YouTube** : **Scrape quotidien** — récupération du **top 30–50 vidéos crypto** (veille si API Google : `order=date` + `publishedAfter`). Une carte n’est créée que si un **transcript** est disponible (sinon aucun agent ne peut utiliser le contenu). Avec les transcripts, Daphnée pourra ensuite éliminer les vidéos inutiles et le placement crypto par influenceurs pour une vue claire de la cryptosphère YouTube. Limites configurables : `INTEL_YOUTUBE_VIDEOS_PER_DAY` (défaut 50), `INTEL_YOUTUBE_MAX_CARDS` (défaut 30). Transcript : skill **youtube-watcher** (yt-dlp), puis npm **youtube-transcript**, puis **yt-dlp** en direct.

## Fichiers

- **Script** : `scripts/intel-scan.js`
- **Sortie** : `data/dashboard/intel/trend_cards.json` — `{ timestamp_utc, date, cards: [ { id, source, title, summary, url?, classification } ] }`
- **Config vidéos** : `dashboard/config/intel_youtube_urls.json` — tableau d’objets `{ "url": "https://...", "title": "optionnel" }`. Les URLs vides ou non-YouTube sont ignorées.

## Classification

Chaque carte a un champ `classification` : `indispensable` / `borderline` / `rejeté`. Par défaut : `borderline`. (Évolution future : LLM ou règles pour classifier.)

## Exécution

```bash
cd trading-empire && node scripts/intel-scan.js
```

Le dashboard (vue **Intel**) affiche les Trend Cards (fusion de `intel_feed.json` et `trend_cards.json`). Pour l’avatar Daphnée : ajouter `agents/intel/intel.png`.
