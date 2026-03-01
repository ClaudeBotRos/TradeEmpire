# Rapport de situation — Agents TradeEmpire

**Date** : 2026-03-01T20:36:41.076Z

| Agent | Statut | Connexions API | Compétences |
|-------|--------|----------------|-------------|
| TECHNICALS | ok | Binance (klines): ok | technicals-scan.js: ok |
| SMART_MONEY | ok | Binance Futures (funding): ok ; Hyperliquid (vaultSummaries): ok | smart-money-scan.js: ok |
| SENTIMENT_X | ok | Twitter/X API v2: ok | sentiment-scan.js: ok |
| ORCHESTRATOR | ok | Fichiers locaux (signaux, idées): ok | Lecture signaux + production idées: ok |
| RISK_JOURNAL | ok | Fichiers locaux (idées, rules): ok | risk-journal-scan.js: ok |
| BOSS | ok | Dashboard (lecture/écriture): ok | boss-night.js: ok |
| INTEL | ok | X (Twitter API v2): ok ; YouTube (youtube-watcher): ok | intel-scan.js: ok |
| CHASE | ok | data/decisions (APPROVED): ok ; data/ideas: ok ; data/tracker (outcomes, post_mortem, feedback): ok | chase-tracker.js: ok |

## Détail par agent
### TECHNICALS
- **Message** : APIs et script OK
- **Connexions** : Binance (klines) (ok) — OK
- **Compétences** : technicals-scan.js (ok)

### SMART_MONEY
- **Message** : APIs et script OK
- **Connexions** : Binance Futures (funding) (ok) — OK ; Hyperliquid (vaultSummaries) (ok) — OK (1)
- **Compétences** : smart-money-scan.js (ok)

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
- **Message** : Trend Cards X + YouTube OK
- **Connexions** : X (Twitter API v2) (ok) — OK (10 tweets) ; YouTube (youtube-watcher) (ok) — Config URLs présente
- **Compétences** : intel-scan.js (ok)

### CHASE
- **Message** : Sync outcomes + post-mortem + feedback OK
- **Connexions** : data/decisions (APPROVED) (ok) — Dossier lisible ; data/ideas (ok) — Dossier lisible ; data/tracker (outcomes, post_mortem, feedback) (ok) — Sortie Chase
- **Compétences** : chase-tracker.js (ok)
