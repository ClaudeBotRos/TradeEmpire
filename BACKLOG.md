# Backlog priorisé — TradeEmpire

Décomposition des étapes PRD en tâches avec dépendances. **MVP** = tâches 1–6 jusqu’à livraison d’un signal TECHNICALS débogué.

---

## Légende

- **Ordre** : ordre recommandé d’exécution.
- **Dép.** : numéros des tâches dont celle-ci dépend.
- **Statut** : À faire / En cours / Fait.

---

## Phase 0 — Design et plan (fait)

| Ordre | Tâche | Dép. | Statut |
|-------|--------|------|--------|
| 0.1 | Rédiger TECHNICAL_DESIGN.md | — | Fait |
| 0.2 | Rédiger BACKLOG.md | — | Fait |

---

## Phase 1 — MVP (workspace + TECHNICALS + OHLCV → 1 signal)

| Ordre | Tâche | Dép. | Livrable | Statut |
|-------|--------|------|----------|--------|
| 1 | Créer l’arborescence `trading-empire/` (rules, data/signals/technicals, data/ideas, data/decisions, data/journal, data/dashboard, scripts, agents) | — | Dossiers vides | Fait |
| 2 | Rédiger `project.md`, `README.md` (watchlist : BTCUSDT pour MVP) | 1 | Fichiers projet | Fait |
| 3 | Rédiger `risk_rules.md`, `strategy_rules.md`, `execution_policy.md` (brouillon) | 1 | Règles | Fait |
| 4 | Script `scripts/fetch-ohlcv.js` : récupérer klines Binance (symbol, interval, limit), sortie JSON ou in-memory | 1 | Script testé (curl/fetch) | Fait |
| 5 | Script `scripts/technicals-scan.js` : lire OHLCV (appel fetch-ohlcv ou intégré), calcul trend/levels/volatility, écrire `data/signals/technicals/{symbol}_{tf}_{timestamp}.json` | 1, 4 | Script + 1 fichier signal | Fait |
| 6 | Tester de bout en bout : lancer `node technicals-scan.js` depuis `trading-empire/` → fichier créé avec champs conformes PRD ; déboguer jusqu’à succès | 2, 3, 5 | MVP livré et débogué | Fait |
| 6b | **Dashboard minimal** : squelette (layout sombre, sidebar, zone centrale) + API lecture `data/signals/technicals/` + affichage des signaux TECHNICALS | 6 | Dashboard MVP opérationnel | Fait |

---

## Phase 2 — Agents et flux (V1)

| Ordre | Tâche | Dép. | Livrable | Statut |
|-------|--------|------|----------|--------|
| 7 | Créer les 6 dossiers agents (boss, orchestrator, sentiment_x, smart_money, technicals, risk_journal) + identity.md + agent.md (squelette) | 6 | Agents déclarés | Fait |
| 8 | Brancher TECHNICALS cron (job OpenClaw ou script seul) pour exécution 08:15 | 6 | Job ou crontab | Fait (run-morning 08:15) |
| 9 | SMART_MONEY : stub ou API funding → `data/signals/smart_money/` | 7 | Signaux smart_money | Fait |
| 10 | SENTIMENT_X : stub ou digest manuel → `data/signals/sentiment/` | 7 | Signaux sentiment | Fait |
| 11 | ORCHESTRATOR : lecture signaux, production 1 idée TRADE_IDEA → `data/ideas/` | 6, 9, 10 | Fichier idée | Fait |
| 12 | RISK_JOURNAL : lecture idées, décision APPROVE/REJECT, écriture `data/decisions/` + `data/journal/` | 11 | Décisions + journal | Fait |
| 13 | BOSS : tâche nocturne (spec/config dashboard) | 7 | Spec ou config | Fait (script + cron 01:00) |
| 14 | Cron : enchaînement complet (08:15 → 08:55 + soir + 01:00 BOSS) | 8, 11, 12, 13 | Séquence complète | Fait (run-morning) |
| 15 | Notification (brief Orchestrator → canal unique) | 12, 14 | 1 message brief | Fait (morning-brief.js + cron WhatsApp) |
| 16 | Enregistrement échanges entre agents (`agent_exchanges.json`) | 11, 12 | Module Wire alimenté | Fait (wire-log.js + run-morning) |

---

## Phase 3 — Dashboard (V1)

| Ordre | Tâche | Dép. | Livrable | Statut |
|-------|--------|------|----------|--------|
| 17 | Dashboard : squelette (layout, sidebar) + lecture `data/` (Wire, Besoins API) | 16 | UI de base | Fait |
| 18 | Modules Team, TimeLine, Niches, Intel, Cost (par priorité) | 17 | Modules livrés | Fait |

---

## Critère de succès MVP (Phase 1)

- [x] Depuis `workspace/TradeEmpire/trading-empire/`, exécution de `node scripts/technicals-scan.js` (ou depuis workspace : `node TradeEmpire/trading-empire/scripts/technicals-scan.js`).
- [x] Fichier créé : `data/signals/technicals/BTCUSDT_4h_<timestamp>.json` (timestamp = YYYYMMDDHHmmss).
- [x] Contenu : `timestamp_utc`, `symbol`, `timeframe`, `trend`, `levels`, `volatility`, `sources` (et optionnellement `setup_candidates`).
- [x] Aucune erreur en exécution ; valeurs numériques cohérentes (trend dérivé des prix, levels dans la fourchette des prix).
- [x] **Dashboard minimal** : ouvrir le dashboard → signaux TECHNICALS visibles (squelette + lecture `data/signals/technicals/`). Lancer `node scripts/dashboard-server.js` puis http://127.0.0.1:3579.

**Job cron** : `tradeempire-technicals` ajouté dans `cron/jobs.json` (08:15 Europe/Paris) ; l’agent exécute le script depuis la racine du workspace.
