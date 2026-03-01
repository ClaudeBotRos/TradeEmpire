# État global du développement — TradeEmpire

**Date** : 2026-03-01

---

## 1. Vue d’ensemble

| Phase | Périmètre | Statut |
|------|-----------|--------|
| **Phase 0** | Design, TECHNICAL_DESIGN, BACKLOG | ✅ Fait |
| **Phase 1 — MVP** | Workspace, TECHNICALS, OHLCV, dashboard minimal | ✅ Fait |
| **Phase 2 — Agents & flux V1** | 5 agents + run-morning, idées, décisions, journal | ✅ Fait |
| **Phase 3 — Dashboard** | Modules PRD (Team, TimeLine, Wire, Niches, Intel, Cost, etc.) | ✅ Fait |
| **Phase 3+** | BOSS nocturne, Wire, notification, idées lisibles, dashboard permanent | ✅ Fait |
| **V2** | Exécution réelle (ASTER) | ⏳ À faire (quand décision) |

---

## 2. Ce qui est en place

### 2.1 Agents et flux

- **TECHNICALS (Alicia)** : `technicals-scan.js` — OHLCV Binance, trend, levels, volatilité → `data/signals/technicals/`.
- **SMART_MONEY (Lucas)** : `smart-money-scan.js` — funding Binance Futures, Hyperliquid (vaults) → `data/signals/smart_money/`.
- **SENTIMENT_X (Melissa)** : `sentiment-scan.js` — Twitter API v2 (crypto/bitcoin) ou stub → `data/signals/sentiment/`.
- **ORCHESTRATOR (Lucy)** : `orchestrator-scan.js` — agrège signaux, produit TRADE_IDEA (entry, invalid, targets, **description**, **glossary**) → `data/ideas/`.
- **RISK_JOURNAL (Pierre-Jaque)** : `risk-journal-scan.js` — lit idées, risk_rules, décide APPROVE/REJECT → `data/decisions/`, `data/journal/`.
- **BOSS** : `boss-night.js` — tâche nocturne (contexte dashboard, spec/config, priorisation Besoins API).

Noms d’affichage (Lucas, Lucy, Melissa, etc.) dans `dashboard/config/team.json` ; Wire et Rapport agents les utilisent.

### 2.2 Séquence et crons

- **08:15 (Europe/Paris)** : `tradeempire-morning` — `run-morning.js` (5 scans + Wire) puis `morning-brief.js` → brief WhatsApp.
- **20:30** : `tradeempire-evening` — `risk-journal-scan.js` (journal mis à jour, pas d’envoi récap).
- **01:00** : `tradeempire-boss-night` — agentTurn BOSS (contexte + spec/config).

### 2.3 Dashboard

- **URL** : http://127.0.0.1:3580
- **Service permanent** : systemd user `tradeempire-dashboard` (`./scripts/dashboard-service.sh start` ; `enable-linger` pour redémarrage après reboot).
- **Design** : Thème sombre type Progra.AI (DASHBOARD_DESIGN.md), bloc principal, sidebar avec icônes, CTA « Brief du jour », actions rapides.
- **Modules** : Avancement (roadmap), Team (avatars, noms, APIs, fichiers), TimeLine (Kanban), Wire (échanges agents), Niches, OpenClaw Intel, Cost, Besoins API, Données (Rapport agents, signaux, idées, décisions, journal).
- **Idées / Niches** : Légende (R:R, Confidence, Invalidation) + cartes détaillées avec **description** en langage naturel par idée (orchestrator remplit `description` et `glossary`).
- **Rapport agents** : `agent-status-report.js` (--light pour APIs seules) → `data/dashboard/agent_status_report.json` ; dashboard affiche statut par agent.

### 2.4 APIs et clés

- **Binance** : klines (public), premiumIndex funding (public).
- **Twitter/X** : API v2 search/recent (`X_BEARER_TOKEN`).
- **Hyperliquid** : vaultSummaries (script SMART_MONEY).
- **ASTER** : doc et client `aster-client.js` prêts pour V2 ; clés dans workspace/DTO.

### 2.5 Qualité et relecture

- **Idées** : Chaque TRADE_IDEA inclut `description` (résumé lisible) et `glossary` (R:R, confidence, invalidation). Voir `docs/IDEE_READABLE.md`.
- **Tests** : `test-agents.js` (par agent ou `--full` avec run-morning + Wire).
- **Rapport agents** : compétences + connexions API par agent.

---

## 3. Prochaine étape recommandée : V2 Exécution

- **Objectif** : Exécution réelle des ordres (ASTER) pour les idées **APPROVED**, avec garde-fous (taille, levier, symboles).
- **À faire** : Script « executor » qui lit les décisions APPROVED, applique `rules/execution_policy.md` et `docs/EXECUTION_ASTER.md`, appelle `aster-client.js` (ordres limit/market selon spec).
- **Réf.** : Roadmap `current_step_id: "v2"`, PRD exécution, BACKLOG Phase 3+.

---

## 4. Optionnel / plus tard

- **Soir** : Envoi récap WhatsApp après 20:30 (actuellement journal seul).
- **Dashboard** : TimeLine avec Kanban éditable, Niches fiches scorées dédiées, Intel flux dédié.
- **Créations Nocturnes** : BOSS crée règles/specs/tâches avec validation humaine.
- **Règles** : Aucun agent ne modifie `rules/` (risk_rules, strategy_rules, execution_policy) sans processus défini.

---

## 5. Fichiers clés

| Rôle | Fichiers / Dossiers |
|------|----------------------|
| Flux matin | `scripts/run-morning.js`, `scripts/wire-log.js`, `scripts/morning-brief.js` |
| Agents | `scripts/*-scan.js`, `agents/{id}/` |
| Idées | `data/ideas/*.json` (TRADE_IDEA avec description, glossary) |
| Dashboard | `dashboard/index.html`, `scripts/dashboard-server.js`, `dashboard/config/team.json` |
| Service dashboard | `~/.config/systemd/user/tradeempire-dashboard.service`, `scripts/dashboard-service.sh` |
| Règles | `rules/risk_rules.md`, `rules/execution_policy.md` |
| Doc exécution | `docs/EXECUTION_ASTER.md`, `docs/IDEE_READABLE.md` |

---

## 6. Résumé une ligne

**État** : MVP + Phase 2 + Phase 3 (dashboard, BOSS nocturne, Wire, notification, idées lisibles, dashboard en service permanent) sont livrés. **Prochaine cible** : V2 Exécution (ASTER) lorsque la décision est prise.
