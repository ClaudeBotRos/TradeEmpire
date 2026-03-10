# Tâches Opportunity Scout

1. **Scanner les sources de diversification** : lire la watchlist actuelle (`data/dashboard/watchlist.json`), les signaux techniques (plusieurs timeframes si disponibles : 1h, 4h, 1D), les niches (`data/dashboard/niches/`), et les trend cards Intel pour repérer des paires ou timeframes peu couverts ou prometteurs.
2. **Proposer des idées de diversification** : produire une liste structurée (paires candidates, timeframes suggérés, raison courte) dans `data/dashboard/scout_proposals.json` avec timestamp. Format : `{ "timestamp_utc", "current_watchlist", "proposals": [ { "symbol", "timeframe?", "reason", "source" } ], "summary" }`.
3. **Alimenter le BOSS / brief** : le rapport peut être lu par `boss-vision.js` ou le brief matin pour afficher des suggestions (ex. « Scout : X paires candidates pour diversification ») sans imposer de changement.
4. **Respecter la stratégie** : les propositions doivent rester cohérentes avec les règles (levier, R:R, symboles éligibles) ; ne pas proposer d’actifs hors scope (ex. pas de marge si non autorisé).
