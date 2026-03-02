# Point — Suite à faire (TradeEmpire)

**Date** : 2026-03-01

---

## Ce qui est fait

- **MVP + Phase 2** : Workspace, TECHNICALS, SMART_MONEY, SENTIMENT_X, ORCHESTRATOR, RISK_JOURNAL opérationnels.
- **Séquence matin** : `run-morning.js` (08:15) enchaîne les 5 scans → signaux → idées → décisions → journal. Cron `tradeempire-morning` actif.
- **Dashboard** : Serveur + modules (Avancement, Team, TimeLine, Wire, Niches, Intel, Cost, Besoins API, Données). Design type Progra.AI (thème sombre, bloc principal, sidebar icônes). **Service permanent** : systemd user `tradeempire-dashboard` (port 3580), script `dashboard-service.sh` (start/stop/status/enable-linger). Pas de vue dédiée « top traders » (usage agent uniquement).
- **Idées lisibles** : Orchestrator remplit `description` et `glossary` sur chaque TRADE_IDEA ; dashboard (Idées, Niches) affiche légende R:R / Confidence / Invalidation + description par carte. Voir `docs/IDEE_READABLE.md`.
- **Agents** : Noms d’affichage (Lucas, Lucy, Melissa, Pierre-Jaque, Alicia) dans `team.json` ; Wire et Rapport agents les utilisent. Avatars servis avec Content-Length + gestion d’erreurs ; favicon 204.
- **Hyperliquid** : Script `fetch-hyperliquid-top.js` pour l’agent SMART_MONEY (vaults) ; données dans `data/hyperliquid/`.
- **Binance / X / ASTER** : Clés documentées et branchées où nécessaire (funding, sentiment, exécution V2 prévue).
- **Point détaillé** : `ETAT_DEVELOPPEMENT.md` pour l’état global du développement.

---

## À faire ensuite (par priorité)

### 1. BOSS — Tâche nocturne (priorité haute) — **Fait**

- **Objectif** : Une exécution chaque nuit (ex. 01:00) qui lit l’état du dashboard, synthétise les besoins API, améliore la spec/config du dashboard, priorise les « Besoins API ».
- **Livré** :
  - `scripts/boss-night.js` : agrège roadmap, api_requests, agent_exchanges, kanban, costs → écrit `data/dashboard/boss_night_context.json` ; crée `dashboard/spec/` et `dashboard/config/` si besoin.
  - Cron `tradeempire-boss-night` à 01:00 Europe/Paris : agentTurn BOSS (exécute le script, lit le contexte, met à jour `dashboard/spec/evolutions.md` et `dashboard/config/api_needs_priority.md`, répond par une ligne de synthèse).
  - Fichiers template : `dashboard/config/api_needs_priority.md`, `dashboard/spec/evolutions.md`.
- **Réf.** : PRD §5.6, roadmap `boss-night`, BACKLOG tâche 13.

### 2. Wire — Alimenter `agent_exchanges.json` — **Fait**

- **Objectif** : Chaque échange entre agents est enregistré dans `data/dashboard/agent_exchanges.json` pour que le module Wire du dashboard affiche un fil d’échanges.
- **Livré** :
  - `scripts/wire-log.js` : helper `appendWire(entry)` qui ajoute une entrée (id, timestamp_utc, from_agent, to_agent, type, context, content_summary, content_ref) et garde les 500 dernières.
  - `run-morning.js` : après chaque script (technicals, smart_money, sentiment, orchestrator, risk_journal), appelle `appendWire` avec le bon from/to/summary/ref.
  - `docs/WIRE_FORMAT.md` : format documenté. Dashboard Wire : tri par date décroissante, affichage context et content_ref.
- **Réf.** : BACKLOG tâche 16, PRD §6.6 / §6.12.

### 3. Notification (brief Orchestrator) — **Fait**

- **Objectif** : Un seul canal (WhatsApp) branché sur l’ORCHESTRATOR : daily brief après la séquence matin.
- **Livré** :
  - `scripts/morning-brief.js` : lit idées et décisions du jour, produit le brief, écrit `data/journal/{date}_brief.md` (PRD §4.4), affiche le brief sur stdout.
  - Cron `tradeempire-morning` (08:15) : exécute run-morning.js puis morning-brief.js ; l’agent répond avec la sortie du brief → livraison WhatsApp (canal unique).
- **Réf.** : BACKLOG tâche 15, PRD §2.1 notification, §9.3.

### 4. V2 Exécution (quand la décision est prise)

- **Objectif** : Exécution réelle des ordres (ASTER) pour les idées APPROVED, selon `rules/execution_policy.md` et `docs/EXECUTION_ASTER.md`.
- **À faire** : Intégrer `aster-client.js` dans un script « executor » déclenché après Risk (ou par cron dédié), avec garde-fous (taille, levier, symboles autorisés).
- **Réf.** : Roadmap `v2`, BACKLOG Phase 3+, PRD exécution.

---

## Optionnel — Fait

- **Soir** : Récap WhatsApp activé (20:30) : `evening-brief.js` après `risk-journal-scan.js`, livraison WhatsApp. Cron `tradeempire-evening` mis à jour.
- **Dashboard TimeLine** : Kanban éditable (POST/PATCH/DELETE /api/kanban/task), formulaire « Nouvelle tâche » + déplacer colonne + supprimer.
- **Niches** : Fiches scorées (`build-niches-fiches.js`, `data/dashboard/niches/`), API `/api/niches`, vue Niches avec score global et détail. Fiches reconstruites dans `run-morning` après orchestrator.
- **Intel (Daphnée)** : Agent **Daphnée** produit des **Trend Cards** (X + top vidéos crypto). Script `intel-scan.js` (X API v2 + YouTube via skill youtube-watcher), sortie `data/dashboard/intel/trend_cards.json`. Config vidéos : `dashboard/config/intel_youtube_urls.json`. Vue Intel fusionne `intel_feed.json` et Trend Cards. **Cron** `tradeempire-intel` 09:00. Wire alimenté en fin de run. Voir `docs/INTEL_DAPHNEE.md`.
- **Chase (Tracker)** : **Cron** `tradeempire-chase` 21:00. Wire alimenté en fin de run. BOSS reçoit `chase_feedback` dans le contexte nocturne.
- **Audit app** : `trading-empire/docs/AUDIT_APP.md` — tour complet des étapes, interactions, crons et actions réalisées (Intel/Chase dans le flux, BOSS + Intel/Chase).
- **Orchestrator + Intel (complément point 2)** : run-morning lance `intel-scan.js` en premier ; l'orchestrator lit les Trend Cards, enrichit les idées (champ `intel`, pondération confidence, description), dashboard affiche Aligné/Décalé Intel et thèmes sur les cartes idées.
- **Créations Nocturnes** : BOSS peut écrire dans `data/dashboard/boss_proposals.json` ; vue dashboard « Propositions BOSS » avec mention « validation humaine requise ».
- **Chase (Tracker)** : Nouvel agent post-mortem. Idées APPROVED enregistrées dans `data/tracker/outcomes/` (pending) ; après remplissage outcome (win/loss/…), `chase-tracker.js` génère post-mortems et feedback par agent. Vue dashboard Chase. Voir `docs/CHASE_TRACKER.md`.

## Optionnel / plus tard

- **V2 Exécution** : attendre quelques jours de validation des idées avant de brancher ASTER.

---

## Résumé une ligne

**Prochaine étape** : **V2 Exécution** (ASTER) dans quelques jours, après vérification que les idées sont validables. En attendant : **Chase (Tracker)** suit les idées APPROVED et produit post-mortem + feedback aux agents. Les 3 tâches optionnelles (soir WhatsApp, Kanban éditable, Niches/Intel, BOSS proposals, Chase) sont faites.
