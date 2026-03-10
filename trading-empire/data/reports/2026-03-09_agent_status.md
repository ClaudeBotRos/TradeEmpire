# Rapport de situation — Agents TradeEmpire

**Date** : 2026-03-09T18:18:31.842Z

| Agent | Statut | Connexions API | Compétences |
|-------|--------|----------------|-------------|
| TECHNICALS | ok | Binance (klines): ok | technicals-scan.js: ok ; tradingview-events-calendar.js: ok ; crypto-indicators-rapidapi.js: ok |
| SMART_MONEY | ok | Binance Futures (funding): ok ; Hyperliquid (vaultSummaries): ok | smart-money-scan.js: ok ; dexscreener-top-traders.js: ok ; binance-copy-leaderboard.js: ok |
| SENTIMENT_X | ok | Twitter/X API v2: ok | sentiment-scan.js: ok |
| ORCHESTRATOR | ok | Fichiers locaux (signaux, idées): ok | Lecture signaux + production idées: ok |
| RISK_JOURNAL | ok | Fichiers locaux (idées, rules): ok | risk-journal-scan.js: ok |
| BOSS | ok | Dashboard (lecture/écriture): ok | boss-night.js: ok |
| INTEL | ok | X (Twitter API v2): ok ; YouTube Data API v3: error ; YouTube (youtube-watcher): ok | intel-scan.js: ok ; economic-calendar-scan.js: ok ; cryptodaily-news.js: ok ; reddit-intel.js: ok |
| CHASE | ok | data/decisions (APPROVED): ok ; data/ideas: ok ; data/tracker (outcomes, post_mortem, feedback): ok | chase-tracker.js: ok |
| TIBO | ok | ASTER (futures): ok ; execution_config.json: ok | executor-run.js: ok ; executor-tp-scrutator.js: ok |
| OPPORTUNITY_SCOUT | ok | scout_proposals.json: ok ; scout_validation_status.json: ok | scout-validation-status.js: ok |
| RECOVERY_ANALYST | ok | recovery_report.json: ok ; recovery_intraday_report.json: ok ; data/tracker/outcomes: ok | Recovery (Killian): ok |
| YIELD_FARMER | ok | yield_farmer_report.json: ok ; uniswap_v3_arbitrum_pools.json: ok | yield-fetch-pools-arbitrum.js: ok ; yield-report.js: ok |
| HYPERLIQUID_ANALYST | ok | commodities_meta.json: ok ; hyperliquid_analyst_report.json: ok | hyperliquid-commodities-scan.js: ok ; hyperliquid-analyst-trend.js: ok |

## Détail par agent
### TECHNICALS
- **Message** : APIs et script OK
- **Connexions** : Binance (klines) (ok) — OK
- **Compétences** : technicals-scan.js (ok) ; tradingview-events-calendar.js (ok) ; crypto-indicators-rapidapi.js (ok)

### SMART_MONEY
- **Message** : APIs et script OK
- **Connexions** : Binance Futures (funding) (ok) — OK ; Hyperliquid (vaultSummaries) (ok) — OK (0)
- **Compétences** : smart-money-scan.js (ok) ; dexscreener-top-traders.js (ok) ; binance-copy-leaderboard.js (ok)

### SENTIMENT_X
- **Message** : Script OK
- **Connexions** : Twitter/X API v2 (ok) — OK (10 tweets)
- **Compétences** : sentiment-scan.js (ok)

### ORCHESTRATOR
- **Message** : Dépendances et script OK
- **Connexions** : Fichiers locaux (signaux, idées) (ok) — technicals:true smart_money:true sentiment:true ideas:true
- **Compétences** : Lecture signaux + production idées (ok)

### RISK_JOURNAL
- **Message** : Règles et script OK
- **Connexions** : Fichiers locaux (idées, rules) (ok) — OK
- **Compétences** : risk-journal-scan.js (ok)

### BOSS
- **Message** : Contexte et script OK
- **Connexions** : Dashboard (lecture/écriture) (ok) — roadmap, spec, config
- **Compétences** : boss-night.js (ok)

### INTEL
- **Message** : Trend Cards X + YouTube + calendrier éco OK
- **Connexions** : X (Twitter API v2) (ok) — OK (10 tweets) ; YouTube Data API v3 (error) — YouTube Data API v3 has not been used in project 451757686034 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=451757686034 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry. ; YouTube (youtube-watcher) (ok) — Transcript (skill)
- **Compétences** : intel-scan.js (ok) ; economic-calendar-scan.js (ok) ; cryptodaily-news.js (ok) ; reddit-intel.js (ok)

### CHASE
- **Message** : Sync outcomes + post-mortem + feedback OK
- **Connexions** : data/decisions (APPROVED) (ok) — Dossier lisible ; data/ideas (ok) — Dossier lisible ; data/tracker (outcomes, post_mortem, feedback) (ok) — Sortie Chase
- **Compétences** : chase-tracker.js (ok)

### TIBO
- **Message** : Executor + Scrutator OK
- **Connexions** : ASTER (futures) (ok) — API key/secret configurés ; execution_config.json (ok) — Config marge / levier
- **Compétences** : executor-run.js (ok) ; executor-tp-scrutator.js (ok)

### OPPORTUNITY_SCOUT
- **Message** : Clarissa (Scout) — Données et script OK
- **Connexions** : scout_proposals.json (ok) — Propositions Clarissa (Scout) ; scout_validation_status.json (ok) — Statut validation
- **Compétences** : scout-validation-status.js (ok)

### RECOVERY_ANALYST
- **Message** : Killian (Recovery) — Données OK
- **Connexions** : recovery_report.json (ok) — Rapport Killian (Recovery) ; recovery_intraday_report.json (ok) — Revue intraday ; data/tracker/outcomes (ok) — Outcomes Chase
- **Compétences** : Recovery (Killian) (ok)

### YIELD_FARMER
- **Message** : Gary (Yield) — Données et scripts OK
- **Connexions** : yield_farmer_report.json (ok) — Rapport Gary (Yield) ; uniswap_v3_arbitrum_pools.json (ok) — Pools Arbitrum (DeFiLlama)
- **Compétences** : yield-fetch-pools-arbitrum.js (ok) ; yield-report.js (ok)

### HYPERLIQUID_ANALYST
- **Message** : Eva (Hyperliquid) — Données et scripts OK
- **Connexions** : commodities_meta.json (ok) — Actifs tokenisés (main + HIP-3) ; hyperliquid_analyst_report.json (ok) — Rapport Eva (Hyperliquid)
- **Compétences** : hyperliquid-commodities-scan.js (ok) ; hyperliquid-analyst-trend.js (ok)
