# Tâches ORCHESTRATOR

- Lire les signaux Intel (`trend_cards.json`), Technicals (dossier + `crypto_indicators_rapidapi.json`), Smart Money (dossier), Sentiment (digest du jour).
- Agréger par symbole : dernier technical (priorité 4h), dernier smart_money, sentiment, indicateurs crypto. Enrichir avec narrative Intel (alignement LONG/SHORT).
- Pour chaque symbole avec trend !== range et levels présents : construire une TRADE_IDEA (entry, invalid, targets, evidence, risk).
- **Adapter en cas de loss (Chase)** : via `chase-feedback-loader.js`, pour les symboles avec loss/invalid_hit récent, ne proposer une idée que si indicateurs RapidAPI (RSI/MACD) présents, alignement Intel non défavorable et confiance ≥ 75 % (sinon ignorer le symbole pour améliorer la technique).
- Écrire jusqu’à 7 idées dans `data/ideas/` avec status PROPOSED et trade_id unique.
