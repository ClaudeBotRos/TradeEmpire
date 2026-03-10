# Outils ORCHESTRATOR

- `scripts/orchestrator-scan.js` : lecture des signaux **Intel** (trend_cards), **Technicals** (dossier + crypto_indicators_rapidapi), **Smart Money** (dossier), **Sentiment** (digest), agrégation par symbole, production des TRADE_IDEA dans `data/ideas/`. Enrichissement des idées avec narrative Intel (alignement narrative / confiance). Utilise **chase-feedback-loader.js** : en cas de loss récent sur un symbole, l’idée n’est proposée que si indicateurs RapidAPI + alignement Intel + confiance ≥ 75 % (amélioration de la technique).
- `scripts/morning-brief.js` : génération du brief du jour (idées, décisions) → `data/journal/{date}_brief.md` et sortie stdout pour envoi canal unique (WhatsApp via cron 08:15).
