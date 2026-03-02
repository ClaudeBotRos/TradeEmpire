# Audit TradeEmpire — Étapes et interactions agents

**Date** : 2026-03-01

---

## 1. Flux matin (run-morning.js)

| Étape | Script | Entrées | Sorties | Wire (from → to) |
|-------|--------|---------|---------|------------------|
| 1 | technicals-scan.js | Binance klines (fetch-ohlcv) | data/signals/technicals/{symbol}_{tf}_{ts}.json | TECHNICALS → ORCHESTRATOR |
| 2 | smart-money-scan.js | Binance funding (fetch-funding) | data/signals/smart_money/{symbol}_{ts}.json | SMART_MONEY → ORCHESTRATOR |
| 3 | sentiment-scan.js | X API v2 (ou stub) | data/signals/sentiment/{date}_x_digest.json | SENTIMENT_X → ORCHESTRATOR |
| 4 | orchestrator-scan.js | technicals, smart_money, sentiment | data/ideas/{trade_id}.json (status PROPOSED) | ORCHESTRATOR → RISK_JOURNAL |
| 5 | build-niches-fiches.js | data/ideas/ | data/dashboard/niches/{trade_id}.json | ORCHESTRATOR → BROADCAST |
| 6 | risk-journal-scan.js | data/ideas/, rules/risk_rules.md | data/decisions/, data/journal/{date}.md, data/tracker/outcomes/ (si APPROVED) | RISK_JOURNAL → BROADCAST |

**Statut** : Complet. Chaque step appelle `appendWire()` après exécution.

**Détail** : Par défaut, technicals tourne sur BTCUSDT 4h ; smart_money et sentiment sur watchlist [BTCUSDT]. Pour multi-symboles (ex. ETHUSDT), il faut passer les symboles en arguments à run-morning ou aux scripts.

---

## 2. Briefs et notifications

| Script | Entrées | Sortie | Déclencheur |
|--------|---------|--------|-------------|
| morning-brief.js | ideas + decisions du jour | data/journal/{date}_brief.md + stdout → WhatsApp | Cron tradeempire-morning (après run-morning) |
| evening-brief.js | decisions + ideas du jour | data/journal/{date}_evening_brief.md + stdout → WhatsApp | Cron tradeempire-evening (après risk-journal-scan) |

**Statut** : Complet.

---

## 3. BOSS (nuit)

| Élément | Détail |
|---------|--------|
| Script | boss-night.js : agrège roadmap, api_requests, agent_exchanges, kanban, costs → boss_night_context.json |
| Contexte fourni au LLM | roadmap, api_requests, agent_exchanges (50 derniers), kanban, costs, instructions (spec, api_needs_priority, boss_proposals) |
| Cron | tradeempire-boss-night à 01:00 Europe/Paris |

**Manque** : Le contexte BOSS ne contient pas les Trend Cards (Intel) ni le feedback Chase (chase_feedback.json). Le BOSS ne peut pas s’appuyer sur l’Intel ou les post-mortems dans ses décisions.

---

## 4. Intel (Daphnée)

| Élément | Détail |
|---------|--------|
| Script | intel-scan.js : X API (tendances) + YouTube (config intel_youtube_urls.json, skill youtube-watcher) → trend_cards.json |
| Sortie | data/dashboard/intel/trend_cards.json |
| Wire | Aucun append Wire actuellement. |
| Cron | Aucun. Intel n’est exécuté que manuellement ou via test-agents (--full). |

**Manques** :
- Pas de cron pour lancer intel-scan (ex. 09:00 après le matin, ou 12:00).
- Pas d’entrée Wire quand Intel produit des Trend Cards.
- L’orchestrator ne lit pas les Trend Cards pour enrichir les idées (optionnel PRD).

---

## 5. Chase (Tracker)

| Élément | Détail |
|---------|--------|
| Script | chase-tracker.js : lit decisions APPROVED → sync outcomes pending ; outcomes complétés → post_mortem ; agrège feedback → chase_feedback.json + data/tracker/feedback/ |
| Entrées | data/decisions/, data/ideas/, data/tracker/outcomes/ |
| Sorties | data/tracker/outcomes/, post_mortem/*.md, feedback/*.md, data/dashboard/chase_feedback.json |
| Wire | Aucun append Wire actuellement. |
| Cron | Aucun. Chase n’est exécuté que manuellement ou via test-agents. |

**Manques** :
- Pas de cron pour lancer chase-tracker (ex. après 20:30 soir, ou 21:00).
- Pas d’entrée Wire quand Chase produit des post-mortems / feedback.

---

## 6. Cron jobs (jobs.json)

| Job | Horaire | Contenu |
|-----|---------|--------|
| tradeempire-morning | 08:15 | run-morning.js puis morning-brief.js → réponse = brief → WhatsApp |
| tradeempire-evening | 20:30 | risk-journal-scan.js puis evening-brief.js → réponse = récap → WhatsApp |
| tradeempire-boss-night | 01:00 | boss-night.js puis LLM lit contexte, met à jour spec + api_needs_priority + boss_proposals |

**Manques** : Aucun job pour intel-scan.js ni chase-tracker.js.

---

## 7. Dashboard (APIs et vues)

| API | Fichier / source | Vue dashboard |
|-----|------------------|----------------|
| /api/roadmap | roadmap.json | Avancement |
| /api/team | team.json | Team |
| /api/wire | agent_exchanges.json | Wire |
| /api/kanban | kanban.json + POST/PATCH/DELETE task | TimeLine |
| /api/niches | data/dashboard/niches/ | Niches |
| /api/intel | intel_feed.json + trend_cards.json (fusion) | OpenClaw Intel |
| /api/costs | costs.json | Cost |
| /api/api_requests | api_requests.json | Besoins API |
| /api/boss_proposals | boss_proposals.json | Propositions BOSS |
| /api/chase_feedback | chase_feedback.json | Chase |
| /api/chase_post_mortems | data/tracker/post_mortem/ | Chase (détail) |
| /api/journal/:date, /api/journal/:date/brief | data/journal/ | Journal |
| /api/signals/*, /api/ideas, /api/decisions | data/signals/, ideas, decisions | Données |
| /api/agent_status_report | agent_status_report.json | Rapport agents |
| /api/agent-photo/:id, /api/agent-files/:id | agents/:id/ | Team |

**Statut** : Complet. Toutes les vues ont une API et des données (ou message vide).

---

## 8. Chaîne de données (résumé)

```
Binance (klines, funding) + X (tweets)
    → TECHNICALS, SMART_MONEY, SENTIMENT_X
    → signaux (technicals/, smart_money/, sentiment/)
    → ORCHESTRATOR → idées PROPOSED (ideas/)
    → build-niches-fiches → niches/
    → RISK_JOURNAL → décisions (APPROVED/REJECTED) + journal + outcomes (pending)
    → morning-brief / evening-brief → journal/*_brief.md → WhatsApp

APPROVED → data/tracker/outcomes/ (pending)
    → (humain remplit outcome: win|loss|…) → chase-tracker.js
    → post_mortem/*.md + chase_feedback.json + feedback/*.md

Intel (X + YouTube) → trend_cards.json (hors flux automatique actuel)
BOSS (nuit) lit roadmap, api_requests, wire, kanban, costs (pas Intel ni Chase)
```

---

## 9. Actions recommandées — réalisées

1. **Cron Intel** : Job `tradeempire-intel` à 09:00 Europe/Paris (intel-scan.js).
2. **Cron Chase** : Job `tradeempire-chase` à 21:00 Europe/Paris (chase-tracker.js).
3. **Wire Intel/Chase** : intel-scan.js et chase-tracker.js appellent `appendWire()` en fin de run (INTEL/CHASE → BROADCAST).
4. **Contexte BOSS** : boss_night_context.json inclut `intel_trend_cards` (date, cards_count, extrait) et `chase_feedback` (post_mortem_count, by_agent) ; instructions mises à jour.
5. **Orchestrator + Intel** : Implémenté. L'orchestrator lit `trend_cards.json` (loadTrendCards), enrichit chaque idée avec `intel` (narrative_summary, themes, aligns_with_narrative), pondère la confidence (+5% si aligné LONG/bullish ou SHORT/bearish, −5% si décalé), et complète la description. Intel est exécuté en première étape de run-morning pour avoir les Trend Cards du jour avant l'orchestrator. Dashboard : cartes idées affichent « Intel (Daphnée) : Aligné / Décalé / Intel » et les thèmes.

---

## 10. Tests et rapport agents

- **test-agents.js** : 7 agents (technicals, smart_money, sentiment, orchestrator, risk_journal, intel, chase) ; mode `--full` lance run-morning + intel-scan + chase-tracker puis valide tout + Wire.
- **agent-status-report.js** : 8 agents (TECHNICALS, SMART_MONEY, SENTIMENT_X, ORCHESTRATOR, RISK_JOURNAL, BOSS, INTEL, CHASE) ; compétences et APIs par agent.

**Statut** : Complet.
