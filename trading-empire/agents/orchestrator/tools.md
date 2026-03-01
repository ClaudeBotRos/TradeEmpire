# Outils ORCHESTRATOR

- `scripts/orchestrator-scan.js` : lecture des trois répertoires de signaux, agrégation, production des TRADE_IDEA dans `data/ideas/`.
- `scripts/morning-brief.js` : génération du brief du jour (idées, décisions) → `data/journal/{date}_brief.md` et sortie stdout pour envoi canal unique (WhatsApp via cron 08:15).
