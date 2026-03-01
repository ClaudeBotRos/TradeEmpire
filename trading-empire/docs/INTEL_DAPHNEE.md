# Intel — Daphnée (Trend Cards)

Agent **Daphnée** documente le module OpenClaw Intel avec des **Trend Cards** issues de :

1. **X (Twitter)** : dernières tendances crypto/bitcoin (API v2 search recent), thèmes dérivés (ETF, bullish/bearish, halving, régulation, DeFi, etc.).
2. **YouTube** : top vidéos crypto du jour — URLs listées dans `dashboard/config/intel_youtube_urls.json` ; pour chaque URL, le script récupère le transcript via la skill **youtube-watcher** (yt-dlp) et produit une carte avec résumé.

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
