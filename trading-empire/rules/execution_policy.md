# Execution Policy

## V1

- **Exécution manuelle ou paper uniquement.**
- Aucun ordre envoyé par le système.

## Mode réel (dashboard)

- **Activation** : dashboard → Exécution → cocher « Mode réel ». Stocké dans `data/dashboard/execution_config.json` (`real_mode`, `notional_usd`).
- **Notional** : 5 $ (avant levier) par idée. Modifiable dans la config.
- **TP / SL** : dérivés de l’idée validée — entrée = ordre limite, invalidation = stop loss (stop market), objectif 1 = take profit (ordre limite reduce-only).
- **Script** : `node scripts/executor-run.js` (à lancer manuellement ou par cron quand `real_mode` est true). Ne place des ordres que pour les idées APPROVED non encore dans `executed_orders.json`.

## V2 (quand activé)

- **Venue d’exécution** : ASTER (AsterDEX futures). Clés API dans DTO/app/.env ; client TradeEmpire : `scripts/aster-client.js`. Voir `docs/EXECUTION_ASTER.md`.
- Exécution automatique uniquement si : stratégie figée, risque strict (max loss/jour, max positions, taille fixe), audit complet, kill switch.
- Agent EXECUTOR très bridé (passe les ordres, point).
