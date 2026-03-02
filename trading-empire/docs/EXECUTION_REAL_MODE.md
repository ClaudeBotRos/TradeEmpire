# Mode réel — Exécution (dashboard)

## Activation

- **Dashboard** → **Exécution** : cocher « Activer le mode réel ».
- La config est stockée dans `data/dashboard/execution_config.json` :
  - `real_mode` : `true` | `false`
  - `notional_usd` : 5 (notional en $ avant levier, par idée)
  - `updated_at` : date de dernière modification

## Comportement

- **Notional** : 5 $ (avant levier) par idée validée. Quantité = `notional_usd / entry.price`, arrondie à 5 décimales.
- **TP et SL** : issus de l’idée APPROVED :
  - **Entrée** : ordre limite (LIMIT GTC) au prix `idea.entry.price`
  - **Stop loss** : ordre stop market au prix `idea.invalid.price` (invalidation)
  - **Take profit** : ordre limite reduce-only au prix `idea.targets[0].price` (premier objectif)
- **Levier** : pris de `idea.risk.leverage` (défaut 1), plafonné à 10.

## Déclenchement

- **Cron** : job `tradeempire-executor` à **08:25** (Europe/Paris), soit après la séquence matin (08:15) et les décisions APPROVED. Si le mode réel est désactivé, le script sort sans rien faire.
- **Manuel** : `node scripts/executor-run.js` depuis `trading-empire/`.

## Script

```bash
node scripts/executor-run.js
```

- Si `real_mode === false` : sort immédiatement (aucun ordre).
- Si `real_mode === true` : charge les décisions APPROVED, exclut les `trade_id` déjà présents dans `data/dashboard/executed_orders.json`, puis pour chaque idée restante appelle ASTER (aster-client.js) : `setLeverage`, `placeOrder` (entrée), `placeStopMarketOrder` (SL), `placeOrder` (TP reduce-only). Enregistre chaque exécution dans `executed_orders.json`.

## API

- `GET /api/execution_config` : retourne la config (real_mode, notional_usd, updated_at).
- `PATCH /api/execution_config` : body `{ "real_mode": true }` ou `{ "notional_usd": 5 }` pour mettre à jour.
- `GET /api/executed_orders` : liste des ordres exécutés par le système (trade_id, symbol, executed_at, …).

## Venue

ASTER (AsterDEX futures). Clés : `ASTER_API_KEY`, `ASTER_SECRET_KEY` (workspace ou DTO/app/.env). Voir `docs/EXECUTION_ASTER.md`.
