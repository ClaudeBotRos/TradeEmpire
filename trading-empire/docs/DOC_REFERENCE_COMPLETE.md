# TradeEmpire / OpenClaw — Documentation de référence complète

**Objectif** : une seule doc pour ne pas se perdre. À lire en priorité quand on reprend le projet ou qu’un agent (IA) doit retrouver le contexte.

---

## 1. Racine et chemins clés

| Élément | Chemin |
|--------|--------|
| **Racine OpenClaw** | `~/.openclaw/` |
| **Workspace partagé (tous les agents)** | `~/.openclaw/workspace/` |
| **Projet TradeEmpire (code + data)** | `~/.openclaw/workspace/TradeEmpire/trading-empire/` |
| **Config OpenClaw (modèles, agents)** | `~/.openclaw/openclaw.json` |
| **Cron jobs** | `~/.openclaw/cron/jobs.json` |
| **Définition des agents** | `~/.openclaw/agents/<agentId>/` (soul, tasks, tools dans le workspace : `workspace/TradeEmpire/trading-empire/agents/<id>/`) |

**Symlinks workspace** : `workspace-boss`, `workspace-tibo`, `workspace-orchestrator`, etc. sont des **liens symboliques vers `workspace`**. Un seul arbre de fichiers partagé. Vérifier : `ls -la ~/.openclaw/workspace-*`.

---

## 2. Dashboard — daemon (pas de lancement manuel en prod)

- **Service systemd utilisateur** : `tradeempire-dashboard.service`
- **Port** : **3580** (pas 3579 en service permanent)
- **URL** : http://127.0.0.1:3580
- **WorkingDirectory** du service : `~/.openclaw/workspace/TradeEmpire/trading-empire` (ou équivalent selon l’hôte)
- **Script de gestion** : depuis `trading-empire` : `./scripts/dashboard-service.sh start|stop|status|enable-linger`
- **Serveur Node** : `scripts/dashboard-server.js` — lit les données dans `data/dashboard/` (résolution via `__dirname` + fallbacks pour trouver `yield_farmer_report.json`, `uniswap_v3_arbitrum_pools.json`, etc.).
- **Vue Yield** : consomme `/api/yield_farmer_report` et `/api/uniswap_v3_arbitrum_pools` ; les données sont aussi injectées dans la page au chargement (`window.__YIELD_BOOT__`) pour affichage même si les APIs échouent.
- **Fichier unit systemd** (utilisateur) : `~/.config/systemd/user/tradeempire-dashboard.service`

Ne pas dire à l’utilisateur de « lancer le serveur à la main » : le dashboard est **déjà en daemon**.

---

## 3. Agents OpenClaw — tous réels

Chaque rôle est un **vrai agent** avec son `agentId`, son modèle (primary + fallbacks), son dossier sous `~/.openclaw/agents/<id>/`. Les crons utilisent cet `agentId` pour que ce soit **son** soul et **son** modèle qui tournent.

| agentId | Rôle principal | Crons typiques |
|---------|----------------|----------------|
| main | Tâches système, fallbacks | agent-report, whatsapp-pending, boss-night-fallback |
| boss | BOSS vision (10h), BOSS nuit (01h) | tradeempire-boss-vision, tradeempire-boss-night |
| tibo | Executor, Scrutateur TP | tradeempire-executor (x3), tradeempire-tp-scrutator |
| orchestrator | Séquence matin, cleanup | tradeempire-morning, tradeempire-cleanup-unexecuted |
| risk_journal | Journal soir | tradeempire-evening |
| intel | Trend Cards / Intel | tradeempire-intel |
| opportunity_scout | Clarissa — Scout propositions | tradeempire-opportunity-scout (x4), scout-validation-status |
| recovery_analyst | Killian — Recovery report + intraday | tradeempire-recovery-analyst, tradeempire-recovery-intraday-* |
| chase | Chase tracker | tradeempire-chase |
| technicals | Scan technique | (job désactivé ou matin) |
| sentiment_x, smart_money | Réservés | — |
| **yield_farmer** | Gary — Yield farming Uniswap V3 (Arbitrum) | tradeempire-yield-farmer (08:00) |
| **hyperliquid_analyst** | Eva — Actifs tokenisés HL (or, pétrole, matières premières), tendances et positions | tradeempire-hyperliquid-analyst (11h, 14h, 17h, 19h) |
| **news_scan** | Parvati — Veille news / catalysts (RSS, CryptoDaily, X) | tradeempire-news-scan (toutes les heures) |

Détail et modèles : **`docs/AGENTS_OPENCLAW_REELS.md`**. Contexte partagé : **`docs/WORKSPACE_PARTAGE.md`**.

**Prénoms (dashboard / team.json)** : BOSS, Lucy (orchestrator), Melissa (sentiment_x), Lucas (smart_money), Alicia (technicals), Pierre-Jaque (risk_journal), Chase, Tibo, Daphnée (intel), **Clarissa** (opportunity_scout), **Killian** (recovery_analyst), **Gary** (yield_farmer), **Eva** (hyperliquid_analyst).

---

## 4. Cron — jobs et règles

- **Fichier** : `~/.openclaw/cron/jobs.json`
- **IDs TradeEmpire principaux** : `tradeempire-morning`, `tradeempire-executor`, `tradeempire-executor-12h`, `tradeempire-executor-15h`, `tradeempire-tp-scrutator`, `tradeempire-boss-vision`, `tradeempire-boss-night`, `tradeempire-intel`, `tradeempire-opportunity-scout`, `tradeempire-recovery-analyst`, `tradeempire-recovery-intraday-*`, `tradeempire-chase`, `tradeempire-yield-farmer`, `tradeempire-whatsapp-pending`, etc.
- **Règle impérative** : **toutes les décisions (ordres, validations, exécution) passent par le LLM**. Aucun script ne doit contourner le LLM pour prendre des décisions. En cas de problème (timeout, modèle), corriger la config (fallbacks, timeouts) plutôt que de découpler.
- **Test d’un job** : `openclaw cron run <job-id>`
- **Audit des scripts/crons** : `cd ~/.openclaw/workspace && node TradeEmpire/trading-empire/scripts/cron-full-audit.js` → rapport dans `data/reports/CRON_FULL_AUDIT_*.md`

Après toute modification de `openclaw.json`, `cron/jobs.json` ou config agents : **tester en conditions réelles** et vérifier provider/model/status dans les runs (règle `.cursor/rules/test-config-changes.mdc`).

---

## 5. Yield Farmer — scripts, données, APIs

- **Agent** : `yield_farmer` (Gary — voir `agents/yield_farmer/soul.md`, `tasks.md`, `tools.md`)
- **Scripts (à lancer depuis la racine du workspace)** :
  - `node TradeEmpire/trading-empire/scripts/yield-fetch-pools-arbitrum.js` → écrit `data/dashboard/uniswap_v3_arbitrum_pools.json` (DeFiLlama, top TVL + stablecoins)
  - `node TradeEmpire/trading-empire/scripts/yield-report.js` → écrit `data/dashboard/yield_farmer_report.json`
- **Config** : `data/dashboard/yield_farmer_config.json` (wallet, chaîne Arbitrum, paire USDC/USDT, etc.)
- **Variables d’environnement** : `workspace/.env` — `THE_GRAPH_API_KEY_UNISWAP` (clé Uniswap Labs API), `YIELD_FARMER_RPC_URL`, `YIELD_FARMER_PRIVATE_KEY` (optionnel)
- **Docs** : `docs/PLAN_YIELD_FARMING.md`, `docs/YIELD_FARMING_UNISWAP_V3.md`, `docs/MEILLEURS_POOLS_ARBITRUM.md`
- **Vue dashboard** : « Yield — Rendements » affiche le rapport + les pools Arbitrum (tableaux top TVL, pools stablecoin). Données fournies par le daemon dashboard (APIs + injection dans la page).

---

## 6. Données dashboard (data/dashboard)

Fichiers clés lus par le serveur dashboard (et souvent par les agents) :

- `yield_farmer_report.json`, `uniswap_v3_arbitrum_pools.json` — Gary (Yield)
- `executor_balance.json`, `tibo_report.json`, `executed_orders.json`, `executor_pending_tp.json` — Exécution
- `boss_vision_context.json`, `boss_night_context.json`, `boss_proposals.json` — BOSS
- `scout_proposals.json`, `scout_validation_status.json` — Clarissa (Scout)
- `recovery_report.json`, `recovery_intraday_report.json` — Killian (Recovery)
- `chase_feedback.json` — Chase
- `execution_config.json`, `roadmap.json`, `kanban.json`, `agent_status_report.json` — Config et état

---

## 7. Règles importantes pour l’agent (IA)

1. **Tester les configs** : après modification de `openclaw.json`, `cron/jobs.json`, agents → lancer un cron adapté et vérifier le run (provider, model, status). Voir `.cursor/rules/test-config-changes.mdc`.
2. **Pas de bypass LLM** : les décisions (ordres, exécution, validations) doivent passer par le LLM. En cas d’échec, corriger la cause (fallbacks, timeouts) au lieu de contourner.
3. **Un seul workspace partagé** : tous les agents travaillent sur `workspace` (symlinks pour boss, tibo, etc.). Ne pas dupliquer ni « flinguer » les chemins en changeant des `agentId` sans raison.
4. **Dashboard en daemon** : le serveur tourne en service systemd (port 3580). Ne pas dire de lancer `node scripts/dashboard-server.js` en prod ; au besoin rappeler `./scripts/dashboard-service.sh status` ou la régénération des JSON Yield + rafraîchir la page.

---

## 8. Index des docs existants (par thème)

- **Agents (détail complet)** : `DOC_AGENTS_REFERENCE.md` — agent par agent, fonction par fonction, scripts et cron.
- **Agents et workspace** : `AGENTS_OPENCLAW_REELS.md`, `WORKSPACE_PARTAGE.md`
- **Cron et tests** : `CRON_FULL_AUDIT.md`, `RECOVERY_INTRADAY_CRONTAB.md`, `CRON_LLM_OVERLAP.md`
- **BOSS** : `BOSS_CREATE_AGENT.md`, charte `TRADEEMPIRE_CHARTER.md`
- **Notifications / WhatsApp** : `AGENT_WHATSAPP.md`, `NOTIFICATION.md`
- **Yield** : `PLAN_YIELD_FARMING.md`, `YIELD_FARMING_UNISWAP_V3.md`, `MEILLEURS_POOLS_ARBITRUM.md`
- **Hyperliquid (actifs tokenisés)** : `HYPERLIQUID_COMMODITIES.md`
- **Chase / Recovery** : `CHASE_TRACKER.md`
- **API / coûts** : `API_KEYS.md`, `COST_API.md`

---

*Dernière mise à jour : 2026-03 — à mettre à jour quand l’architecture ou les chemins changent.*
