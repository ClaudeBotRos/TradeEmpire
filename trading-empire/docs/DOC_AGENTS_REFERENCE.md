# TradeEmpire — Documentation agents et scripts (référence complète)

Documentation **agent par agent**, **fonction par fonction** : rôles, tâches, scripts et responsabilités. À utiliser avec `docs/DOC_REFERENCE_COMPLETE.md` (chemins, cron, dashboard) et `docs/DATA_FLOW_AGENTS.md` (flux de données).

---

## 1. Index des agents

| agentId | Prénom | Rôle principal | Scripts principaux |
|---------|--------|----------------|--------------------|
| **boss** | BOSS | Stratégie, brief nuit/vision, priorités | boss-night.js, boss-vision.js, queue-boss-vision-brief.js |
| **tibo** | Tibo | Exécution ASTER + Hyperliquid, scrutateur TP, rapport | executor-run.js, build-execution-queue.js, executor-hyperliquid.js, executor-tp-scrutator.js, tibo-report.js |
| **orchestrator** | Lucy | Synthèse signaux → TRADE_IDEA | run-morning.js, orchestrator-scan.js, cleanup-unexecuted-decisions.js, morning-brief.js |
| **risk_journal** | Pierre-Jaque | Validation règles → APPROVED/REJECTED | risk-journal-scan.js, evening-brief.js |
| **chase** | Chase | Post-mortem, outcomes, feedback, annulation ordres obsolètes | chase-tracker.js, chase-loss-diagnostic.js |
| **intel** | Daphnée | Trend Cards (X, YouTube, macro, CryptoDaily, Reddit) | intel-scan.js, economic-calendar-scan.js, cryptodaily-news.js, reddit-intel.js |
| **news_scan** | Parvati | Veille news / catalysts (RSS, CryptoDaily, X) | news-scan.js |
| **recovery_analyst** | Killian | Rapport outcomes, revue intraday, annulation ASTER | recovery-analyst-report.js, recovery-intraday-review.js |
| **opportunity_scout** | Clarissa | Propositions diversification (watchlist, paires) | opportunity-scout.js, scout-validation-status.js |
| **yield_farmer** | Gary | Yield Uniswap V3 (Arbitrum), rapports | yield-fetch-pools-arbitrum.js, yield-report.js |
| **hyperliquid_analyst** | Eva | Actifs tokenisés HL, tendances, recommandations | hyperliquid-commodities-scan.js, hyperliquid-analyst-trend.js |
| **technicals** | Alicia | Signaux techniques (OHLCV, levels, indicateurs) | technicals-scan.js, crypto-indicators-rapidapi.js, tradingview-events-calendar.js |
| **sentiment_x** | Melissa | Sentiment X (narratives, thèmes) | sentiment-scan.js, enrich-sentiment-flow.js |
| **smart_money** | Lucas | Funding, Dexscreener, Binance Copy | smart-money-scan.js, dexscreener-top-traders.js, binance-copy-leaderboard.js, smart-money-discover-*.js |
| **main** | — | Tâches système, fallbacks | agent-status-report.js, cost-api-update.js, send-whatsapp-pending.js, etc. |

---

## 2. Conventions et chemins

- **Racine projet** : `~/.openclaw/workspace/TradeEmpire/trading-empire/`
- **Agents (soul, tasks, tools)** : `agents/<agentId>/soul.md`, `tasks.md`, `tools.md`
- **Scripts** : `scripts/*.js` — à lancer depuis la racine du **workspace** : `node TradeEmpire/trading-empire/scripts/<script>.js`
- **Données** : `data/` (ideas, decisions, tracker, signals, dashboard, journal, reports)
- **Wire (échanges agents)** : `data/dashboard/agent_exchanges.json` — écrit par `wire-log.js` (appendWire)

---

## 3. Séquence run-morning (ordre d’exécution)

Exécutée par le cron **tradeempire-morning** (Orchestrator). Chaque étape enregistre un échange dans le Wire.

| # | Script | Agent source → cible | Sortie / ref |
|---|--------|----------------------|--------------|
| 1 | economic-calendar-scan.js | INTEL → ORCHESTRATOR | economic_calendar.json |
| 2 | cryptodaily-news.js | INTEL → ORCHESTRATOR | cryptodaily_news.json |
| 3 | reddit-intel.js | INTEL → ORCHESTRATOR | reddit_intel.json |
| 4 | intel-scan.js | INTEL → ORCHESTRATOR | trend_cards.json |
| 5 | news-scan.js | NEWS_SCAN → ORCHESTRATOR | news_scan_report.json |
| 6 | technicals-scan.js | TECHNICALS → ORCHESTRATOR | data/signals/technicals/ |
| 7 | crypto-indicators-rapidapi.js | TECHNICALS → ORCHESTRATOR | crypto_indicators_rapidapi.json |
| 8 | smart-money-scan.js | SMART_MONEY → ORCHESTRATOR | data/signals/smart_money/ |
| 9 | smart-money-discover-wallets.js | SMART_MONEY → SMART_MONEY | dexscreener_wallets.txt |
| 10 | dexscreener-top-traders.js | SMART_MONEY → ORCHESTRATOR | dexscreener_holders.json |
| 11 | smart-money-discover-portfolios.js | SMART_MONEY → SMART_MONEY | binance_copy_portfolio_ids.txt |
| 12 | binance-copy-leaderboard.js | SMART_MONEY → ORCHESTRATOR | binance_copy_leaderboard.json |
| 13 | sentiment-scan.js | SENTIMENT_X → ORCHESTRATOR | data/signals/sentiment/ |
| 14 | enrich-sentiment-flow.js | SENTIMENT_X → ORCHESTRATOR | *_sentiment_flow.json |
| 15 | orchestrator-scan.js | ORCHESTRATOR → RISK_JOURNAL | data/ideas/ |
| 16 | build-niches-fiches.js | ORCHESTRATOR → BROADCAST | data/dashboard/niches/ |
| 17 | risk-journal-scan.js | RISK_JOURNAL → BROADCAST | data/decisions/, data/journal/ |

En fin de run : `appendWire(RISK_JOURNAL → BOSS)`.

---

## 4. Agents — détail par agent

### 4.1 BOSS (agentId: boss)

**Rôle** : Pilote stratégique. Brief nuit et vision, priorités dashboard/API, propositions d’évolution. Ne trade pas.

**Soul (résumé)** : Visionnaire, à l’écoute de Chase, coordinateur de tous les agents. Nuit = consolidation ; vision = expansion. Peut créer des agents (spec + create-agent-from-spec.js) ou proposer via boss_proposals.json.

**Tâches** : Rationalisation coûts X (intel_x_limits.json) ; tâche nocturne (brief, spec/config, Kanban) ; tâche visionnaire (boss_vision_context, boss_expansion_proposals.md, boss_proposals.json) ; lecture tibo_report ; création d’agents si besoin.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **boss-night.js** | Remplit boss_night_context.json (solde ASTER, âge des données, PnL, chase_feedback). Préparation du brief de nuit. |
| **boss-vision.js** | Remplit boss_vision_context.json (solde, PnL, chase_feedback, coûts API). Contexte pour la tâche vision/expansion. |
| **queue-boss-vision-brief.js** | Met le résumé vision en file WhatsApp (whatsapp_pending). |
| **boss-night-brief-generate.js** | Génération du brief de nuit (contenu). |
| **boss-night-brief-to-whatsapp-fallback.js** | Envoi du dernier brief nocturne en file WhatsApp (fallback). |
| **run-boss-night-complete.js** | Enchaîne les étapes complètes de la nuit BOSS. |
| **create-agent-from-spec.js** | Lit boss_create_agent_spec.json, crée l’agent sous agents/<id>/ et met à jour le team. |

**Lecture** : boss_night_context.json, boss_vision_context.json, tibo_report.json, chase_feedback.json, costs.json, roadmap, kanban, api_needs_priority, agent_profit_suggestions.json.  
**Écriture** : last_boss_brief.md, boss_expansion_proposals.md, boss_proposals.json, evolutions.md, api_needs_priority.md, kanban_completed.json.

---

### 4.2 Tibo (agentId: tibo)

**Rôle** : Exécution des ordres (ASTER et Hyperliquid), scrutateur TP, rapport d’exécution.

**Soul (résumé)** : Exécutant fiable, méticuleux (tibo_report à jour), discipliné (respect des APPROVED), transparent pour BOSS et Chase.

**Tâches** : (1) Executor ASTER — placer entrée + SL des idées APPROVED ; (2) Executor Hyperliquid — placer ordres HL depuis la file ; (3) Scrutator — si entrée FILLED, placer TP et mettre à jour pending ; (4) Rapport — tibo_report.json après chaque run.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **build-execution-queue.js** | Lit decisions APPROVED + ideas, applique recovery (priorité symboles sans perte), option entry_price_refresh (mark ASTER ± tight_spread_pct). Produit execution_queue.json. |
| **executor-run.js** | Lit execution_queue (ou reconstruit depuis decisions si file vide/vieille). Place sur ASTER : stop-market entrée, stop-market SL, enregistre executed_orders.json et executor_pending_tp.json. Respecte max_trades_per_day, execution_config. |
| **executor-hyperliquid.js** | Lit hyperliquid_orders_queue.json (ou auto-seed depuis hyperliquid_analyst_report.json). Place ordres limit GTC sur Hyperliquid (SDK). Min 10 USD notional. Écrit executed_orders_hyperliquid.json. |
| **run-tp-scrutator-if-needed.js** | Lance executor-tp-scrutator.js seulement s’il y a des TP en attente (executor_pending_tp.json). |
| **executor-tp-scrutator.js** | Vérifie statut des ordres d’entrée sur ASTER ; si FILLED, place le Take Profit (LIMIT reduceOnly), met à jour executed_orders et pending TP. |
| **tibo-report.js** | Met à jour tibo_report.json (dernier run, solde, ordres du jour, pending TP, erreurs). Appelé après executor ou scrutator. appendWire(TIBO → BOSS). |

**Lecture** : execution_config.json, execution_queue.json, data/decisions/*_APPROVED.json, data/ideas/, hyperliquid_orders_queue.json, commodities_meta.json (HL).  
**Écriture** : executed_orders.json, executor_pending_tp.json, executed_orders_hyperliquid.json, tibo_report.json.

---

### 4.3 Orchestrator (agentId: orchestrator)

**Rôle** : Agrégation des signaux (Intel, Technicals, Smart Money, Sentiment) et production des TRADE_IDEA.

**Soul (résumé)** : Synthétique, prudent après un loss (Chase), structuré (evidence + narrative + confiance), pragmatique (pas de survente).

**Tâches** : Lire trend_cards, technicals, smart_money, sentiment ; agréger par symbole ; construire TRADE_IDEA (entry, invalid, targets, evidence, risk) ; adapter en cas de loss Chase (confiance ≥ 75 %, indicateurs + alignement Intel) ; écrire jusqu’à 7 idées PROPOSED dans data/ideas/.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **run-morning.js** | Enchaîne les 17 étapes run-morning (economic-calendar → risk-journal-scan), appendWire à chaque étape. Point d’entrée du cron matin. |
| **orchestrator-scan.js** | Lit trend_cards, technicals (dossier + crypto_indicators_rapidapi), smart_money (dossier), sentiment (digest). Pour chaque symbole avec trend et levels : construit TRADE_IDEA (entry = support/résistance, invalid, targets R:R). Utilise chase-feedback-loader pour serrer les critères après loss. Écrit data/ideas/*.json (PROPOSED). |
| **cleanup-unexecuted-decisions.js** | Déplace les APPROVED non exécutées depuis plus de 48 h vers data/decisions/expired/. |
| **morning-brief.js** | Génère le brief du jour (idées, décisions) → data/journal/{date}_brief.md et stdout pour WhatsApp. |
| **build-niches-fiches.js** | Met à jour les fiches niches (data/dashboard/niches/) pour le broadcast. |

**Lecture** : trend_cards.json, economic_calendar.json, data/signals/technicals/, crypto_indicators_rapidapi.json, data/signals/smart_money/, data/signals/sentiment/, chase-feedback-loader.  
**Écriture** : data/ideas/*.json, data/journal/*.md, data/dashboard/niches/.

---

### 4.4 Risk Journal (agentId: risk_journal)

**Rôle** : Validation des idées selon risk_rules (R:R, levier, max loss). Décisions APPROVED / REJECTED.

**Soul (résumé)** : Intransigeant sur les règles, adaptatif après loss Chase (serrer R:R, levier), transparent (motif lisible), protecteur du capital.

**Tâches** : Lire idées PROPOSED et risk_rules.md ; adapter règles si chase-feedback signale des losses ; pour chaque idée vérifier conformité ; écrire data/decisions/{trade_id}_{status}.json et data/journal/{date}.md.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **risk-journal-scan.js** | Lit data/ideas/ (status PROPOSED), rules/risk_rules.md, chase-feedback-loader. Pour chaque idée : validateIdea (max_loss, leverage, R:R, entry/invalid cohérence). Écrit decisions (APPROVED/REJECTED/NEED_MORE_INFO), met à jour status dans l’idée, écrit journal du jour. |
| **evening-brief.js** | Génère le récap du soir (décisions, journal) → sortie pour WhatsApp. |

**Lecture** : data/ideas/, rules/risk_rules.md, chase-feedback-loader.  
**Écriture** : data/decisions/*.json, data/journal/{date}.md.

---

### 4.5 Chase (agentId: chase)

**Rôle** : Suivi des positions fermées, mise à jour des outcomes, post-mortems, feedback par agent, annulation des ordres obsolètes, diagnostic des pertes.

**Soul (résumé)** : Direct et factuel, méthodique (sync, annulations, post-mortems), tourné vers les agents (feedback lisible), autonome (ASTER + executed_orders).

**Tâches** : (1) Vérifier positions fermées (ASTER vs executed_orders), mettre à jour outcomes ; (2) Annuler ordres obsolètes (stale, après loss, orphelins) ; (3) Sync idées APPROVED → outcomes pending ; (4) Post-mortem par outcome complété ; (5) Utiliser tibo_report dans post-mortems et feedback ; (6) Agréger feedback par agent ; (7) Diagnostic des pertes (chase-loss-diagnostic).

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **chase-tracker.js** | Interroge ASTER (positionRisk, userTrades), compare avec executed_orders ; met à jour data/tracker/outcomes/*.json ; annule ordres obsolètes (CHASE_STALE_ORDER_PCT, loss récent, orphelins) ; sync APPROVED → outcomes ; génère post-mortems (data/tracker/post_mortem/) ; écrit chase_feedback.json et data/tracker/feedback/*.md ; appelle runDiagnostic (chase-loss-diagnostic). appendWire(CHASE → BOSS, CHASE → BROADCAST). |
| **chase-loss-diagnostic.js** | Scan outcomes loss, agrège par symbole/direction/timeframe, calcule confiance moyenne des pertes ; produit chase_loss_diagnostic.json et .md (causes possibles, recommandations). Export runDiagnostic() pour appel par chase-tracker. |
| **sync-closed-outcomes-and-chase.js** | Synchronisation manuelle outcomes + Chase si besoin (hors cron). |

**Lecture** : executed_orders.json, tibo_report.json, data/decisions/, data/ideas/, ASTER (getAccount, getOpenOrders, cancelOrder).  
**Écriture** : data/tracker/outcomes/*.json, data/tracker/post_mortem/*.md, data/tracker/feedback/*.md, data/dashboard/chase_feedback.json, chase_loss_diagnostic.json/.md.

---

### 4.6 Intel / Daphnée (agentId: intel)

**Rôle** : Trend Cards (X, YouTube, macro, CryptoDaily, Reddit) pour narrative du jour.

**Soul (résumé)** : Curieuse, sélective (contenu utile vs bruit), synthétique, débrouillarde (APIs, transcripts).

**Tâches** : X (recherche recent crypto/bitcoin) ; YouTube (top vidéos + transcript, classification rejeté/borderline) ; Calendrier économique ; CryptoDaily ; Reddit ; sortie trend_cards.json, economic_calendar.json, cryptodaily_news.json, reddit_intel.json.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **intel-scan.js** | Appelle getCachedXPosts() (x-posts-cache), YouTube Data API + transcripts, lit economic_calendar, cryptodaily_news, reddit_intel. Construit situation_summary, situation_by_source, cards[]. Écrit trend_cards.json, intel_scan_status.json. appendWire(INTEL → ORCHESTRATOR). |
| **economic-calendar-scan.js** | Lit calendrier (RapidAPI Ultimate Economic Calendar ou config economic_calendar_events.json). Écrit data/dashboard/intel/economic_calendar.json (events: date, time_utc, country, event, importance, forecast, previous, actual). |
| **cryptodaily-news.js** | Appel RapidAPI CryptoDaily → data/dashboard/intel/cryptodaily_news.json (items title, url, date). |
| **reddit-intel.js** | RapidAPI Reddit getSimilarSubreddits (cryptocurrency, bitcoin, ethereum…) → data/dashboard/intel/reddit_intel.json. |

**Lecture** : economic_calendar.json, cryptodaily_news.json, reddit_intel.json, X (cache), YouTube API, config intel_youtube_filter.json.  
**Écriture** : trend_cards.json, intel_scan_status.json, economic_calendar.json (via economic-calendar-scan), cryptodaily_news.json, reddit_intel.json.

---

### 4.7 NEWS_SCAN / Parvati (agentId: news_scan)

**Rôle** : Veille news / macro crypto ; agrégation RSS + CryptoDaily + X → catalysts pour SENTIMENT_X et orchestrator.

**Soul (résumé)** : Centralise actualités (CryptoDaily, Coindesk, X) ; produit catalysts ; ne décide pas, n’exécute pas.

**Tâches** : CryptoDaily (ou RSS prioritaire) ; Coindesk (RSS) ; X trending (cache ou API) ; rapport unique news_scan_report.json (catalysts, rss_aggregate, x_trending).

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **news-scan.js** | Charge config news_rss_feeds.json. Priorité : (1) external_aggregate_path si récent ; (2) fetchRssAggregate (feeds) ; (3) CryptoDaily API. Coindesk depuis RSS ou API. X trending depuis trend_cards. Construit catalysts[], écrit news_scan_report.json (timestamp_utc, cryptodaily, coindesk, rss_aggregate, x_trending, catalysts). appendWire(NEWS_SCAN → BOSS). |

**Lecture** : news_rss_feeds.json, cryptodaily_news.json (fallback), trend_cards.json (X).  
**Écriture** : data/dashboard/intel/news_scan_report.json.

---

### 4.8 Recovery Analyst / Killian (agentId: recovery_analyst)

**Rôle** : Rapport outcomes (win/loss/invalid_hit/target_hit) ; revue intraday des ordres ASTER (keep/cancel) ; alimentation BOSS et dashboard.

**Soul (résumé)** : Analytique, synthétique, tourné vers l’action (prioriser symboles/causes), calme.

**Tâches** : (1) Lire outcomes Chase, agréger par symbole/cause → recovery_report.json ; (2) Réévaluer ordres ouverts ASTER vs trend → keep/cancel ; (3) Avec --apply-cancel, annuler sur ASTER ; (4) Scout : lire scout_proposals pour diversification.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **recovery-analyst-report.js** | Parcourt data/tracker/outcomes/*.json (hors pending), agrège par symbole et par outcome. Écrit recovery_report.json, option --md → data/reports/YYYY-MM-DD_recovery.md. appendWire(RECOVERY_ANALYST → BOSS). |
| **recovery-intraday-review.js** | Lit ordres ouverts ASTER (getOpenOrders), trend (technicals). Pour chaque ordre d’entrée : recommandation keep/cancel. Écrit recovery_intraday_report.json. --apply-cancel : appelle cancelOrder sur ASTER. Option --md pour rapport MD. |
| **recovery-intraday-context.js** | Prépare le contexte pour la revue intraday (données techniques, scout). |
| **run-recovery-intraday-standalone.js** | Lance la revue intraday en autonome (technicals + recovery-intraday-review). |

**Lecture** : data/tracker/outcomes/, data/decisions/, executed_orders.json, data/signals/technicals/, scout_proposals.json, ASTER getOpenOrders.  
**Écriture** : recovery_report.json, recovery_intraday_report.json, data/reports/*_recovery.md ; REVOKED uniquement si option dédiée.

---

### 4.9 Opportunity Scout / Clarissa (agentId: opportunity_scout)

**Rôle** : Propositions de diversification (paires, timeframes) hors watchlist actuelle.

**Soul (résumé)** : Explorateur, structuré, pragmatique, discret (propose sans modifier watchlist ni idées).

**Tâches** : Lire watchlist, technicals, niches, trend_cards ; identifier paires/timeframes sous-exploités ; écrire scout_proposals.json ; option WhatsApp si seuil de propositions.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **opportunity-scout.js** | Lit watchlist.json, technicals (derniers par symbole/timeframe), niches, trend_cards. Scan critères (volume, funding, liquidité). Produit propositions (paires, timeframes, critères). Écrit scout_proposals.json. --no-whatsapp désactive la file WhatsApp. appendWire(OPPORTUNITY_SCOUT → BOSS). |
| **scout-validation-status.js** | Génère scout_validation_status.json (quelles propositions ont été validées/exécutées). Option --md. |

**Lecture** : watchlist.json, data/signals/technicals/, data/dashboard/niches/, trend_cards.json.  
**Écriture** : scout_proposals.json, scout_validation_status.json, file whatsapp_pending (si seuil).

---

### 4.10 Yield Farmer / Gary (agentId: yield_farmer)

**Rôle** : Faire fructifier le capital dormant (Uniswap V3, paires stables USDC/USDT) sur Arbitrum.

**Soul (résumé)** : Rentier prudent (APY 5–15 %), vigilant (seuils, alertes), autonome (rapports et recommandations), transparent.

**Tâches** : Actualiser pools Arbitrum ; rapport (APY, capital, alertes) ; recommandations d’allocation ; pas d’exécution on-chain sans validation.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **yield-fetch-pools-arbitrum.js** | Récupère meilleurs pools Uniswap V3 Arbitrum (DeFiLlama : top TVL, stables). Écrit uniswap_v3_arbitrum_pools.json. |
| **yield-report.js** | Synthèse quotidienne (capital, rendement, alertes, recommandations). Écrit yield_farmer_report.json. appendWire(YIELD_FARMER → BOSS). |
| **yield-verify-connection.js** | Vérification connexion (RPC, API) pour le yield. |

**Lecture** : yield_farmer_config.json, uniswap_v3_arbitrum_pools.json, executor_balance/tibo_report, PLAN_YIELD_FARMING.md, risk_rules.  
**Écriture** : yield_farmer_report.json, uniswap_v3_arbitrum_pools.json (via yield-fetch-pools), agent_profit_suggestions.json.

---

### 4.11 Hyperliquid Analyst / Eva (agentId: hyperliquid_analyst)

**Rôle** : Analyse des actifs tokenisés Hyperliquid (or, pétrole, matières premières, actions HIP-3) ; tendances et recommandations.

**Soul (résumé)** : Spécialisé matières premières, data-driven (API HL + intel + macro), complémentaire (rapport consommé par BOSS/executor), transparent.

**Tâches** : Actualiser commodities_meta (API HL) ; analyser tendances + contexte (Parvati, Intel, calendrier macro, RSS HIP-3) ; rapport avec recommendations (symbol, side, reason, confidence, data_sources) ; pas d’exécution directe.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **hyperliquid-commodities-scan.js** | Appelle API HL (perpDexs, allPerpMetas, metaAndAssetCtxs). Filtre or, pétrole, matières premières, actions. Écrit data/hyperliquid/commodities_meta.json, hip3_dexes.json. |
| **hyperliquid-analyst-trend.js** | Lit commodities_meta, news_scan_report (→ context_news), trend_cards (→ context_intel), economic_calendar (→ context_macro), config hyperliquid_analyst_sources.json (→ fetch RSS HIP-3 : Kitco, Yahoo Finance, Oilprice). Construit recommendations (GOLD, BRENTOIL, etc.) avec data_sources. Écrit hyperliquid_analyst_report.json (context_news, context_intel, context_macro, context_hip3_news). appendWire(HYPERLIQUID_ANALYST → BOSS). |
| **hyperliquid-balance.js** | Récupère solde HL (clearinghouseState + spotClearinghouseState), affiche portfolio value. |
| **fetch-hyperliquid-top.js** | Récupère leading vaults HL → data/hyperliquid/leading_vaults_*.json. |

**Lecture** : commodities_meta.json, hip3_dexes.json, news_scan_report.json, trend_cards.json, economic_calendar.json, hyperliquid_analyst_sources.json, risk_rules.md.  
**Écriture** : hyperliquid_analyst_report.json, commodities_meta.json, hip3_dexes.json (via commodities-scan).

---

### 4.12 Technicals / Alicia (agentId: technicals)

**Rôle** : Signaux techniques (OHLCV, trend, levels, indicateurs) par symbole.

**Soul (résumé)** : Cartésienne, organisée, discrète (pas de surinterprétation), réactive (TradingView après loss Chase).

**Tâches** : Produire signaux (structure, niveaux, tendance, volatilité) ; indicateurs RSI/MACD/EMA (RapidAPI) ; calendrier TradingView (optionnel, après loss).

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **technicals-scan.js** | Récupère OHLCV (Binance/fetch-ohlcv ou équivalent), calcule trend, levels (support/resistance), volatilité. Écrit data/signals/technicals/{symbol}_{tf}_{ts}.json. |
| **crypto-indicators-rapidapi.js** | Appel RapidAPI indicateurs (RSI, MACD, EMA) par symbole. Écrit data/signals/technicals/crypto_indicators_rapidapi.json. |
| **tradingview-events-calendar.js** | Calendrier événements par symbole (RapidAPI TradingView). Écrit tradingview_events_calendar.json. Lancé optionnellement par run-morning après loss Chase. |

**Lecture** : Binance/API OHLCV, RapidAPI, chase-feedback (pour activation TradingView).  
**Écriture** : data/signals/technicals/*.json.

---

### 4.13 Sentiment_X / Melissa (agentId: sentiment_x)

**Rôle** : Sentiment X (Twitter) : thèmes, narratives (bullish/bearish, ETF, régulation) pour l’orchestrator.

**Soul (résumé)** : À l’écoute du récit, filtre signal/bruit, concis, complémentaire.

**Tâches** : Interroger X (recherche recent crypto/bitcoin) ; extraire thèmes et tendances ; digest consommable par orchestrator ; enrichissement avec funding (enrich-sentiment-flow).

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **sentiment-scan.js** | Utilise getCachedXPosts() (x-posts-cache). Extrait thèmes, narratives. Écrit data/signals/sentiment/{date}_x_digest.json. |
| **enrich-sentiment-flow.js** | Enrichit le digest sentiment avec funding rate (ventes/achats). Produit *_sentiment_flow.json. |

**Lecture** : X (cache partagé), funding (Binance/fetch-funding ou équivalent).  
**Écriture** : data/signals/sentiment/*.json.

---

### 4.14 Smart Money / Lucas (agentId: smart_money)

**Rôle** : Funding, OI, top traders (Dexscreener, Binance Copy) pour flux et divergences.

**Soul (résumé)** : En quête de flux, sourcé, contrarian friendly, équipe (avec technicals + sentiment).

**Tâches** : Funding par symbole ; Dexscreener (wallets → holders) ; Binance Copy (leaderboard) ; découverte wallets/portfolios via Apify (optionnel).

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **smart-money-scan.js** | Récupère funding (Binance premiumIndex ou fetch-funding). Écrit data/signals/smart_money/{symbol}_{ts}.json (mark_price, fundingRate, etc.). |
| **dexscreener-top-traders.js** | Lit dexscreener_wallets.txt, récupère holders pour chaque wallet. Écrit dexscreener_holders.json. |
| **binance-copy-leaderboard.js** | Lit binance_copy_portfolio_ids.txt, récupère détail portfolios. Écrit binance_copy_leaderboard.json. |
| **smart-money-discover-wallets.js** | Apify « Dexscreener Top Traders » → remplit dexscreener_wallets.txt (si APIFY_API_TOKEN). |
| **smart-money-discover-portfolios.js** | Apify « Binance Copy Trading Scraper » → remplit binance_copy_portfolio_ids.txt. |

**Lecture** : Binance API funding, dexscreener_wallets.txt, binance_copy_portfolio_ids.txt.  
**Écriture** : data/signals/smart_money/*.json, dexscreener_holders.json, binance_copy_leaderboard.json, dexscreener_wallets.txt, binance_copy_portfolio_ids.txt.

---

### 4.15 Main (agentId: main)

**Rôle** : Tâches système, fallbacks, rapports globaux, coûts API, WhatsApp pending.

**Scripts / fonctions**

| Script | Fonction |
|--------|----------|
| **agent-status-report.js** | Rapport global des agents (état des données, âge des fichiers, erreurs). Écrit agent_status_report.json et data/reports/*_agent_status.md. |
| **cost-api-update.js** | Met à jour les coûts API (X, RapidAPI, etc.) dans data/dashboard/costs.json ou équivalent. |
| **send-whatsapp-pending.js** | Envoie les messages en file (whatsapp_pending.json) vers WhatsApp. |
| **notify-user-whatsapp.js** | Ajoute un message à la file WhatsApp (pour les agents qui veulent alerter l’utilisateur). |
| **whatsapp-queue-push.js** | Push d’un message dans la queue WhatsApp. |
| **apply-kanban-completed.js** | Marque les tâches Kanban complétées (kanban_completed.json). |
| **cron-full-audit.js** | Audit des scripts et crons TradeEmpire → rapport CRON_FULL_AUDIT_*.md. |
| **cron-audit-by-agent.js** | Audit par agent (jobs associés). |
| **cron-test-and-audit.js** | Test et audit des crons. |

---

## 5. Scripts partagés / utilitaires

| Script | Fonction |
|--------|----------|
| **wire-log.js** | appendWire({ from_agent, to_agent, type, context, content_summary, content_ref }) → écrit dans data/dashboard/agent_exchanges.json. Utilisé par run-morning, chase, tibo, recovery, scout, yield, hyperliquid, news_scan, risk (via run-morning). |
| **load-workspace-env.js** | Charge les variables d’environnement depuis workspace/.env (et DTO/app/.env si présent). Requis en tête de la plupart des scripts. |
| **aster-client.js** | Client ASTER (AsterDEX futures) : getExchangeInfo, getSymbolPrecision, getMarkPrice, getAccount, getOpenOrders, placeOrder, placeStopMarketOrder, placeMarketOrder, cancelOrder, setLeverage. Auth HMAC-SHA256 (ASTER_API_KEY, ASTER_SECRET_KEY). |
| **chase-feedback-loader.js** | hasRecentLosses(), getLossSymbols() — indique si Chase a signalé des pertes récentes (par symbole). Utilisé par orchestrator-scan et risk-journal-scan pour adapter règles et critères. |
| **x-posts-cache.js** | getCachedXPosts(), getCachedOrFetch(), hourlyKey(), fetchXCanonical(). Cache horaire des appels X API (search recent). Utilisé par intel-scan et sentiment-scan pour réduire les requêtes. |
| **log-x-usage.js** | Suivi usage API X (coûts, quotas). |
| **load-intel-x-limits.js** | Charge intel_x_limits.json (x_max_results_intel, x_max_results_sentiment, etc.) pour rationalisation coûts BOSS. |
| **fetch-funding.js** | Récupère funding rate (et mark price) Binance USDT-M (API publique). Sortie JSON stdout. |
| **fetch-ohlcv.js** | Récupère OHLCV (klines) pour un symbole/timeframe (Binance ou autre). |
| **sync-executed-orders-with-aster.js** | Synchronise executed_orders.json avec l’état réel ASTER (positions, ordres). |
| **chase-feedback-loader.js** | (déjà cité) — chargement du feedback Chase pour adaptation orchestrator/risk_journal. |

---

## 6. Cron → Agent → Scripts (référence)

| Job ID (exemples) | Agent | Scripts appelés |
|-------------------|--------|------------------|
| tradeempire-morning | orchestrator | run-morning.js, morning-brief.js |
| tradeempire-cleanup-unexecuted | orchestrator | cleanup-unexecuted-decisions.js |
| tradeempire-executor | tibo | build-execution-queue.js, executor-run.js, executor-hyperliquid.js |
| tradeempire-executor-12h, 15h | tibo | idem |
| tradeempire-executor-soir | tibo | idem (après Chase soir) |
| tradeempire-tp-scrutator | tibo | run-tp-scrutator-if-needed.js |
| tradeempire-evening | risk_journal | risk-journal-scan.js, evening-brief.js |
| tradeempire-boss-night | boss | boss-night.js, (brief write), evolutions, api_needs, kanban, queue-boss-vision-brief, etc. |
| tradeempire-boss-vision | boss | boss-vision.js, (write boss_expansion_proposals), boss_proposals, queue-boss-vision-brief.js |
| tradeempire-intel | intel | intel-scan.js |
| tradeempire-news-scan | news_scan | news-scan.js |
| tradeempire-opportunity-scout (×4) | opportunity_scout | opportunity-scout.js |
| tradeempire-recovery-analyst | recovery_analyst | recovery-analyst-report.js |
| tradeempire-recovery-intraday-* | recovery_analyst | technicals-scan.js, recovery-intraday-review.js --apply-cancel |
| tradeempire-chase, tradeempire-chase-matin | chase | chase-tracker.js |
| tradeempire-yield-farmer | yield_farmer | yield-fetch-pools-arbitrum.js, yield-report.js |
| tradeempire-hyperliquid-analyst | hyperliquid_analyst | hyperliquid-commodities-scan.js, hyperliquid-analyst-trend.js (+ lecture rapport par LLM) |
| tradeempire-cost-api-refresh | main | cost-api-update.js |
| tradeempire-agent-status-report | main | agent-status-report.js |
| tradeempire-whatsapp-pending | main | send-whatsapp-pending.js |
| tradeempire-scout-validation-status | — | scout-validation-status.js |

---

## 7. Fichiers de configuration clés

| Fichier | Rôle |
|---------|------|
| execution_config.json | real_mode, notional_usd, max_trades_per_day, default_leverage, entry_price_refresh, tight_spread_pct |
| risk_rules.md | R:R min, leverage max, leverage max confiance ≥80 %, max trades/jour |
| news_rss_feeds.json | RSS Parvati (feeds, use_rss_first, min_items_to_skip_api) |
| hyperliquid_analyst_sources.json | keywords_by_asset, hip3_rss_feeds (precious_metals, equities, energy) |
| intel_youtube_filter.json | Filtres YouTube (max_borderline_cards, min_transcript_length) |
| economic_calendar_events.json | Fallback événements macro (saisie manuelle) |
| intel_x_limits.json | x_max_results_intel, x_max_results_sentiment (rationalisation coûts BOSS) |

---

---

## 8. Référence croisée : script → agent(s)

| Script | Agent(s) principal(aux) | Appelé par |
|--------|-------------------------|------------|
| run-morning.js | orchestrator | Cron tradeempire-morning |
| orchestrator-scan.js | orchestrator | run-morning |
| risk-journal-scan.js | risk_journal | run-morning, cron evening |
| build-execution-queue.js | tibo | Cron executor (×4) |
| executor-run.js | tibo | Cron executor |
| executor-hyperliquid.js | tibo | Cron executor |
| chase-tracker.js | chase | Cron chase (×2) |
| chase-loss-diagnostic.js | chase | chase-tracker (appel interne) |
| intel-scan.js | intel | run-morning, cron intel |
| news-scan.js | news_scan | run-morning, cron news-scan |
| hyperliquid-analyst-trend.js | hyperliquid_analyst | Cron hyperliquid-analyst |
| recovery-analyst-report.js | recovery_analyst | Cron recovery-analyst |
| recovery-intraday-review.js | recovery_analyst | Cron recovery-intraday (×3) |
| opportunity-scout.js | opportunity_scout | Cron opportunity-scout (×4) |
| yield-report.js | yield_farmer | Cron yield-farmer |
| boss-night.js, boss-vision.js | boss | Cron boss-night, boss-vision |
| wire-log.js | tous (partagé) | run-morning, chase, tibo, recovery, scout, yield, hyperliquid, news_scan |
| aster-client.js | tibo, chase, recovery, executor-run | Scripts ASTER |
| x-posts-cache.js | intel, sentiment_x | intel-scan, sentiment-scan |
| chase-feedback-loader.js | orchestrator, risk_journal | orchestrator-scan, risk-journal-scan |

---

*Dernière mise à jour : 2026-03. À mettre à jour quand un agent ou un script est ajouté/modifié.*
