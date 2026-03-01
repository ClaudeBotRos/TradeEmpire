# Tâches ORCHESTRATOR

- Lire les signaux dans `data/signals/technicals/`, `data/signals/smart_money/`, `data/signals/sentiment/` (dernier digest du jour).
- Agréger par symbole : dernier technical (priorité 4h), dernier smart_money, sentiment du digest.
- Pour chaque symbole avec trend !== range et levels présents : construire une TRADE_IDEA (entry, invalid, targets, evidence, risk).
- Écrire jusqu’à 7 idées dans `data/ideas/` avec status PROPOSED et trade_id unique.
