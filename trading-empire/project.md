# Trading Empire — Projet

## Objectif

- Produire des idées de trades structurées, auditables et reproductibles.
- Maintenir un journal quotidien.
- Limiter strictement le risque.
- Aucune exécution automatique en V1.

## Univers

- Crypto spot + perp (watchlist ci-dessous).
- **Watchlist** : définie dans `data/dashboard/watchlist.json` (symbols). Par défaut : BTC, ETH + alts (SOL, DOGE, XRP, AVAX, LINK, ARB, OP, SUI, ADA, MATIC, DOT, ATOM, LTC). Les scripts technicals, smart_money et sentiment chargent cette liste lorsqu’ils sont lancés sans arguments (ex. par run-morning).

## Cadence

- Morning brief : 08:30
- Midday update : 13:00 (optionnel)
- Evening recap : 20:30

## Sorties attendues

- `data/signals/**` (sentiment, smart_money, technicals)
- `data/ideas/**` (trade ideas PROPOSED)
- `data/decisions/**` (APPROVED/REJECTED par risk_journal)
- `data/journal/**` (journal quotidien)

## Règle d’or

Si une donnée est incertaine ou non vérifiable, elle est marquée `low_confidence` et ne peut pas déclencher une idée de trade.
