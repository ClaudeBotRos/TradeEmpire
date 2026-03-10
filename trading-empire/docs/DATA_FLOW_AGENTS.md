# Flux des données entre agents — TradeEmpire

Résumé de l’agrégation et de la transmission des signaux vers les bons agents.

## Séquence run-morning (ordre d’exécution)

| Étape | Script | De → Vers | Données produites / lues |
|-------|--------|-----------|---------------------------|
| 1 | economic-calendar-scan.js | INTEL → ORCHESTRATOR | `economic_calendar.json` (macro) |
| 2 | cryptodaily-news.js | INTEL → ORCHESTRATOR | `cryptodaily_news.json` (actualités crypto) |
| 3 | reddit-intel.js | INTEL → ORCHESTRATOR | `reddit_intel.json` (subreddits similaires) |
| 4 | intel-scan.js | INTEL → ORCHESTRATOR | `trend_cards.json` (X, YouTube, macro, CryptoDaily, Reddit) + `intel_scan_status.json` |
| 5 | technicals-scan.js | TECHNICALS → ORCHESTRATOR | `data/signals/technicals/{symbol}_{tf}_{ts}.json` (OHLCV, trend, levels) |
| 6 | crypto-indicators-rapidapi.js | TECHNICALS → ORCHESTRATOR | `crypto_indicators_rapidapi.json` (RSI, MACD, EMA par symbole) |
| 7 | smart-money-scan.js | SMART_MONEY → ORCHESTRATOR | `data/signals/smart_money/{symbol}_{ts}.json` (funding) |
| 8 | smart-money-discover-wallets.js | SMART_MONEY → SMART_MONEY | Remplit `dexscreener_wallets.txt` via Apify (si APIFY_API_TOKEN + seeds) |
| 9 | dexscreener-top-traders.js | SMART_MONEY → ORCHESTRATOR | `dexscreener_holders.json` (holders des wallets listés) |
| 10 | smart-money-discover-portfolios.js | SMART_MONEY → SMART_MONEY | Remplit `binance_copy_portfolio_ids.txt` via Apify (si APIFY_API_TOKEN) |
| 11 | binance-copy-leaderboard.js | SMART_MONEY → ORCHESTRATOR | `binance_copy_leaderboard.json` (détail portfolios) |
| 12 | sentiment-scan.js | SENTIMENT_X → ORCHESTRATOR | `data/signals/sentiment/{date}_x_digest.json` |
| 13 | orchestrator-scan.js | ORCHESTRATOR → RISK_JOURNAL | `data/ideas/*.json` (TRADE_IDEA) |
| 14 | build-niches-fiches.js | ORCHESTRATOR → BROADCAST | Fiches niches |
| 15 | risk-journal-scan.js | RISK_JOURNAL → BROADCAST | `data/decisions/`, `data/journal/` |

## Liens entre agents (résumé)

- **INTEL** → ORCHESTRATOR (trend_cards, economic_calendar, cryptodaily, reddit) ; INTEL → BROADCAST (dashboard, BOSS).
- **TECHNICALS** → ORCHESTRATOR (signaux techniques, crypto_indicators, tradingview_events).
- **SMART_MONEY** → ORCHESTRATOR (funding, dexscreener_holders, binance_copy_leaderboard) ; SMART_MONEY → SMART_MONEY (découverte Apify).
- **SENTIMENT_X** → ORCHESTRATOR (digest sentiment).
- **ORCHESTRATOR** → RISK_JOURNAL (TRADE_IDEA) ; ORCHESTRATOR → BROADCAST (fiches niches).
- **RISK_JOURNAL** → BROADCAST (décisions, journal).
- **Tibo** → BOSS / dashboard (tibo_report, executed_orders). **Chase** → BROADCAST (chase_feedback).

Chaque étape run-morning enregistre l’échange dans `data/dashboard/agent_exchanges.json` (Wire).

## Qui lit quoi

### Orchestrator (Lucy)
- **Trend Cards** (`trend_cards.json`) : narrative = X + macro (calendrier éco) + Reddit + CryptoDaily ; thèmes pour alignement LONG/SHORT.
- **Technicals** (dossier) : derniers signaux par symbole (symbol, timeframe, trend, levels) pour construire les idées.
- **Crypto indicators** (`crypto_indicators_rapidapi.json`) : RSI, MACD par symbole ajoutés dans `evidence.technicals` des idées.
- **Smart money** (dossier) : funding par symbole.
- **Sentiment** (digest du jour) : sentiment par symbole, narratives.

→ Produit les **TRADE_IDEA** dans `data/ideas/`.

### BOSS (nuit)
- **tibo_report.json** : suivi exécution (ordres du jour, TP en attente, solde).
- **trend_cards** (via boss_night_context) : toutes les cartes Intel (X, YouTube, macro, CryptoDaily, Reddit) pour contexte.
- **chase_feedback** : post-mortems et retours par agent.
- **roadmap, api_requests, kanban, costs** : état du dashboard.

### Risk Journal (Pierre-Jaque)
- **data/ideas/** : idées proposées.
- **rules/** : règles d’approbation.
→ Produit **décisions** (APPROVED/REJECTED) et **journal**.

### Tibo (Executor + Scrutator)
- **data/decisions/** : idées APPROVED à exécuter.
- **execution_config** : notional, levier.
→ Place les ordres, enregistre dans **executed_orders.json**, **executor_pending_tp.json**, et déclenche **tibo_report.json**.

### Chase
- **data/ideas/**, **data/decisions/**, **data/tracker/outcomes/** : idées, décisions, résultats (win/loss).
- **tibo_report.json** : pour le feedback à Tibo (exécution, TP en attente).
→ Produit **chase_feedback.json** (post-mortems, retours par agent) et **chase_post_mortems**.

## Découverte des listes (délégation à l’agent Smart Money)

Les listes de wallets (Dexscreener) et de portfolio IDs (Binance Copy) peuvent être **remplies automatiquement** par des scripts qui s’appuient sur Apify :

- **smart-money-discover-wallets.js** : lit des tokens seeds (`dexscreener_seed_tokens.txt` ou `DEXSCREENER_SEED_TOKENS`), appelle l’acteur Apify « Dexscreener Top Traders Scraper », et écrit les URLs des top traders dans `dexscreener_wallets.txt`. Ensuite `dexscreener-top-traders.js` lit ce fichier et récupère les holders pour chaque wallet.
- **smart-money-discover-portfolios.js** : appelle l’acteur Apify « Binance Copy Trading Scraper » (mode leaderboard), extrait les `portfolioId`, et écrit `binance_copy_portfolio_ids.txt`. Ensuite `binance-copy-leaderboard.js` lit ce fichier et récupère le détail de chaque portfolio.

Condition : `APIFY_API_TOKEN` (ou `APIFY_TOKEN`) dans `workspace/.env`. Sans token, les scripts de découverte ne font rien (no-op) et les listes restent manuelles ou inchangées.

## Fichiers optionnels (hors run-morning par défaut)

- **tradingview-events-calendar.js** : calendrier d’événements par symbole (TradingView). Sortie : `tradingview_events_calendar.json` dans technicals. Utilisé par le **dashboard** (vue Signaux techniques) ; pas encore intégré dans la narrative des idées (possible extension).

## Dashboard (affichage)

- **Daphnée Intel** : trend_cards, economic_calendar, cryptodaily_news, reddit_intel.
- **Signaux techniques** : technicals (dossier), crypto_indicators_rapidapi, tradingview_events_calendar.
- **Idées / Décisions** : data/ideas, data/decisions.
- **Rapports Tibo** : tibo_report.json.
- **BOSS** : propositions, Kanban, contexte nocturne.
