# Étape suivante après le PRD — Développement efficace

Une fois le PRD en place, l’étape qui limite le plus les bavures et accélère le dev est : **Design technique + Backlog priorisé**, puis un **premier livrable minimal (MVP)** pour valider le flux avant de tout construire.

---

## 1. Pourquoi cette étape

- Le **PRD** dit **quoi** faire (objectifs, agents, données, dashboard, garde-fous).
- Il manque encore **comment** le construire (stack, composants, flux d’exécution) et **dans quel ordre** (tâches, dépendances).
- Sans design technique : risques de rework, interfaces floues, intégrations douloureuses.
- Sans backlog priorisé : on ne sait pas par où commencer ni quoi livrer en premier.

---

## 2. L’étape suivante en trois blocs

### 2.1 Design technique (TDD / spec technique)

**Objectif** : Fixer la **stack**, les **flux** et les **interfaces** pour que l’implémentation soit cohérente.

À produire (un seul doc ou plusieurs, selon la taille) :

| Sujet | Contenu |
|-------|---------|
| **Stack & prérequis** | OpenClaw (version / usage), ClawRouter actif, langage des outils (scripts, extensions), stack du dashboard (front : React/Vue/autre, hébergement, lecture des fichiers `data/`). |
| **Exécution des agents** | Comment une tâche cron déclenche un agent (commande OpenClaw, script wrapper, API) ; ordre des appels (Technicals → Smart money → Sentiment → Orchestrator → Risk) ; passage du modèle LLM par agent (config ou fichier). |
| **Connecteurs** | Comment le connecteur OHLCV est appelé (API exchange, lib, script) ; où sont les clés (env, config) ; format de réponse et où il est écrit (`data/signals/technicals/`). |
| **Dashboard** | Comment le front lit les données (fichiers JSON dans `data/dashboard/`, API locale, ou base) ; authentification si besoin ; déploiement (local, serveur, Docker). |
| **Points d’intégration** | ClawRouter (proxy 8402), exchange (Bybit/Binance), Telegram (bot OpenClaw) ; qui appelle qui. |

**Livrable** : un document **Technical Design** ou **Architecture** (ex. `TECHNICAL_DESIGN.md` ou `ARCHITECTURE.md`) dans `workspace/TradeEmpire/`.

---

### 2.2 Backlog priorisé (décomposition des étapes PRD)

**Objectif** : Transformer les étapes A–F du PRD en **tâches atomiques**, ordonnées par **dépendances**, pour un développement sans trous ni blocages.

Exemple de décomposition (à ajuster) :

| Ordre | Tâche | Dépendances | Livrable |
|-------|--------|-------------|----------|
| 1 | Créer l’arborescence `trading-empire/` (dossiers rules, data, agents, dashboard) | Aucune | Arborescence vide |
| 2 | Rédiger `project.md`, `README.md`, watchlist | 1 | Fichiers projet |
| 3 | Rédiger `risk_rules.md`, `strategy_rules.md`, `execution_policy.md` (brouillon) | 1 | Règles |
| 4 | Créer les 6 dossiers agents (boss, orchestrator, …) + identity.md + agent.md par agent (squelette) | 2, 3 | Agents déclarés |
| 5 | Implémenter le connecteur OHLCV (exchange) et le tester | 1 | Script ou outil + test |
| 6 | Remplir `tasks.md` et `tools.md` pour TECHNICALS ; brancher OHLCV → sortie `data/signals/technicals/` | 4, 5 | TECHNICALS opérationnel (1 signal) |
| 7 | Idem SMART_MONEY (stub ou API funding si dispo) | 4, 5 | Signaux smart_money |
| 8 | Idem SENTIMENT_X (stub ou digest manuel) | 4 | Signaux sentiment |
| 9 | ORCHESTRATOR : lecture des signaux, production d’une idée TRADE_IDEA (1 exemple) | 6, 7, 8 | Fichier dans `data/ideas/` |
| 10 | RISK_JOURNAL : lecture idées, décision APPROVE/REJECT, écriture `data/decisions/` + `data/journal/` | 9 | Décisions + journal |
| 11 | BOSS : tâche nocturne (lecture dashboard, écriture spec/config) | 4 | Spec ou config |
| 12 | Cron : enchaînement 08:15 → 08:55 + soir + 01:00 BOSS | 6–11 | Séquence complète |
| 13 | Notification Telegram (brief par Orchestrator) | 9, 12 | 1 message brief |
| 14 | Enregistrement des échanges entre agents (`agent_exchanges.json`) | 6–10 | Module Wire alimenté |
| 15 | Dashboard : squelette (layout, sidebar) + lecture `data/` (Wire, Besoins API) | 1, 14 | UI de base |
| 16 | Dashboard : modules Team, TimeLine, Niches, Intel, Cost (par priorité) | 15 | Modules livrés un par un |

**Livrable** : un **backlog** (liste ou Kanban) avec ces tâches et leurs liens ; peut vivre dans `data/dashboard/kanban.json` plus tard ou dans un fichier `BACKLOG.md` / outil externe.

---

### 2.3 Premier livrable minimal (MVP / vertical slice)

**Objectif** : Valider le **flux de bout en bout** avec le minimum de code pour détecter les erreurs de conception tôt.

**MVP proposé** :

1. **Workspace** : arborescence + `project.md` + `rules/` (brouillon).
2. **Un seul agent « plein »** : TECHNICALS avec connecteur OHLCV réel (1 exchange, 1 symbole, 1 timeframe).
3. **Sortie** : un fichier `data/signals/technicals/BTCUSDT_4h_<timestamp>.json` produit par une exécution (cron ou manuelle).
4. **Dashboard minimal** : squelette (layout sombre, sidebar, zone centrale) + lecture et affichage des signaux TECHNICALS depuis `data/signals/technicals/`. Indispensable pour visualiser les sorties du système dès le MVP.

**Critère de succès** : (1) lancer une tâche TECHNICALS → le fichier signal est créé avec les champs attendus (trend, levels, volatility). (2) Ouvrir le dashboard → les signaux techniques s’affichent. Ensuite on enchaîne avec les autres agents et le reste (Orchestrator, Risk, journal, modules avancés du dashboard).

---

## 3. Ordre recommandé

1. **Rédiger le Design technique** (TDD / Architecture) — 1 à 2 jours selon la précision voulue.
2. **Écrire le Backlog priorisé** (décomposition + dépendances) — 0,5 à 1 jour.
3. **Démarrer par le MVP** (workspace + TECHNICALS + OHLCV → 1 signal) — valider que le flux agent → outil → fichier fonctionne.
4. **Enchaîner** avec le reste du backlog (agents, Orchestrator, Risk, cron, notification, dashboard).

---

## 4. Où ranger les livrables

| Livrable | Emplacement suggéré |
|----------|---------------------|
| Design technique | `workspace/TradeEmpire/TECHNICAL_DESIGN.md` ou `ARCHITECTURE.md` |
| Backlog (liste ou phasage) | `workspace/TradeEmpire/BACKLOG.md` ou premier `data/dashboard/kanban.json` |
| Définition du MVP | Dans ce fichier ou en en-tête de `BACKLOG.md` |

---

## 5. Résumé

**Étape suivante après le PRD** :  
**Design technique** → **Backlog priorisé** → **MVP (1 agent + 1 connecteur + 1 sortie)** → puis développement incrémental selon le backlog.

Cela limite les bavures en fixant le « comment » et l’ordre de travail avant de coder, et en validant le flux avec un premier slice minimal.
