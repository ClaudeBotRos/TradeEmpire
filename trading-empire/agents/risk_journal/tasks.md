# Tâches RISK_JOURNAL

- Lire toutes les idées dans `data/ideas/` dont status === PROPOSED.
- Lire `rules/risk_rules.md` (max perte par trade, leverage max, R:R minimum).
- Pour chaque idée : vérifier conformité (max_loss_usd, leverage, targets R:R, cohérence entry/invalid selon direction).
- Décider APPROVED / REJECTED / NEED_MORE_INFO et écrire `data/decisions/{trade_id}_{status}.json`.
- Mettre à jour le status dans le fichier idée.
- Écrire le journal du jour `data/journal/{date}.md` (résumé des idées et décisions avec raisons).
