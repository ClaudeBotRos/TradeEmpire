# Outils Chase (Tracker)

- `scripts/chase-tracker.js` : synchronise les idées APPROVED vers data/tracker/outcomes/, génère les post-mortems pour les outcomes complétés, écrit le feedback par agent dans data/tracker/feedback/.
- Fichiers outcome : data/tracker/outcomes/{trade_id}.json (outcome: pending | win | loss | invalid_hit | target_hit ; exit_price, note, closed_at). À remplir manuellement ou par un système de clôture.
- Les agents (TECHNICALS, SMART_MONEY, etc.) peuvent lire data/tracker/feedback/{agent}.md ou chase_feedback.json pour s’améliorer.
