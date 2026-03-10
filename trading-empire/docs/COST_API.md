# Calcul des coûts API (X, ClawRouter, OpenRouter)

Les coûts sont centralisés dans `data/dashboard/costs.json` et affichés dans le dashboard (section Coûts).

## Sources

| API | Type | Calcul |
|-----|------|--------|
| **X (Twitter)** | Usage (pay-per-use) | X ne fournit pas d’API pour récupérer le coût en $. Il faut le mettre à jour depuis le [portail développeur](https://console.x.com) (Utilisation → Coût total) ou en définissant `X_COST_USD` avant de lancer le script (ex. `X_COST_USD=7.49 node scripts/cost-api-update.js`). Le script ne remet plus le coût à 0 s’il est déjà renseigné. **Usage** : [Usage API](https://docs.x.com/x-api/usage/get-usage) `GET https://api.x.com/2/usage/tweets`. Coût $ : portail ou `X_COST_USD`. [Pricing](https://docs.x.com/x-api/getting-started/pricing). |
| **ClawRouter (BlockRun)** | Usage | Paiement x402 à l’usage. Pas d’API d’usage côté OpenClaw ; renseigner `cost` ou `usage_usd` à la main si besoin. |
| **OpenRouter** | Usage | Récupéré automatiquement via `GET https://openrouter.ai/api/v1/key` si `OPENROUTER_API_KEY` est défini (dans `.env` ou env du cron). Champs remplis : `usage_usd`, `usage_monthly_usd`, `cost`. |

## Balance (gains − coûts)

Le dashboard affiche en tête de la vue Coûts :
- **Total coûts** : somme des `api_costs[].cost` + `fixed_costs[].amount` + `trading.fees` + `trading.funding_paid`
- **Total gains** : `gains.total_gains_usd` ou, à défaut, `trading.realized_pnl_usd`
- **Balance** : total gains − total coûts (en vert si ≥ 0, en rouge si < 0)

Pour afficher une balance, renseigner dans `costs.json` soit `gains.total_gains_usd`, soit `trading.realized_pnl_usd` (PnL réalisé trading).

## Mise à jour

```bash
# Depuis la racine du workspace TradeEmpire (trading-empire/)
node scripts/cost-api-update.js
```

- **X** : appelle `GET https://api.x.com/2/usage/tweets` et enregistre `x_project_usage`, `x_project_cap` ; lit `usage_x.json` pour `requests_this_month`. Coût $ : `X_COST_USD` ou manuel (l’API ne renvoie que les comptages).
- **OpenRouter** : si `OPENROUTER_API_KEY` est défini, appelle l’API OpenRouter et remplit `usage_usd`, `usage_monthly_usd`, `cost`.
- **ClawRouter** : seul `last_updated` est mis à jour ; coût à saisir manuellement.

Pour que OpenRouter soit rempli automatiquement (ex. cron quotidien), ajoute dans ton `.env` ou dans l’environnement du job :

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

(La même clé que celle utilisée pour le BOSS dans OpenClaw convient.)

## Références tarifaires

- **X (Twitter)** : Free 0 €, Basic ~200 USD/mois (15k reads), Pro ~5000 USD/mois. [Pricing X](https://developer.x.com/en/docs/twitter-api/pricing)
- **OpenRouter** : facturation au token selon le modèle (Qwen, DeepSeek, etc.) ; pas d’abonnement. [OpenRouter Pricing](https://openrouter.ai/docs/faq)
- **ClawRouter** : paiement à la requête via wallet x402 (BlockRun).
