# BOSS Expansion Proposals — 2026-03-10

## Contexte du jour
- Solde disponible: 98.57 USDT | PnL réalisé: +8.95 USDT (33 trades, 26W/7L, ~79% win rate)
- 34 post-mortems majoritairement en annulé/invalidation sans perte (ADA, ATOM, BTC, LTC)
- Coûts API: X $18.52, OpenRouter $1.37 — maîtrisés

## Pistes concrètes

1. **Augmenter la taille des positions** — Avec un win rate de 79% et un R:R conservateur, proposer une règle pour passer le levier max de 1→2 sur les signaux à confiance ≥80% (RISK_JOURNAL à valider).

2. **Nouvel agent: NEWS_SCAN** — Créer un agent dédié au scraping/news (CryptoDaily, Coindesk, X trending) pour alimenter SENTIMENT_X avec des catalysts en temps réel. suggested_id: "NEWS_SCAN", rôle: veille macro/crypto.

3. **Élargir la watchlist** — Scout a identifié 7 paires hors watchlist. Ajouter 2-3 paires avec volume/funding favorable (ex: SOLUSDT, AVAXUSDT) après validation des critères de liquidité.

4. **Optimisation X API** — 3703/2M requêtes utilisées. Proposer un cache des posts X pour réduire les appels GET répétitifs sur les mêmes accounts (gain: ~30% requêtes).

5. **Passive income exploration** — Scout a mentionné "Best Passive Income Strategies". Créer une tâche de recherche hebdomadaire sur yield farming/staking compatibles avec le capital actuel.
