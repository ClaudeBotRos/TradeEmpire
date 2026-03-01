# PRD — Trading Empire (OpenClaw)

**Document** : Product Requirements Document — Trading Empire, agent multi-agents pour idées de trades crypto  
**Version** : 1.4  
**Date** : 2026-03-01  
**Statut** : Spécification détaillée (pré-implémentation)  
**Source** : Transposition du plan `idea.txt` (POD Empire → Trading Empire)

---

## Table des matières

1. [Contexte et vision](#1-contexte-et-vision)  
2. [Périmètre fonctionnel](#2-périmètre-fonctionnel)  
3. [Hiérarchie des agents : le BOSS et les 5 opérationnels](#3-hiérarchie-des-agents-le-boss-et-les-5-opérationnels)  
4. [Modèle de données et contrats](#4-modèle-de-données-et-contrats)  
5. [Cadence, cron et enchaînement](#5-cadence-cron-et-enchaînement)  
6. [Dashboard (modules et Créations Nocturnes)](#6-dashboard-modules-et-évolutivité)  
7. [Outils et connecteurs](#7-outils-et-connecteurs)  
8. [Garde-fous et conformité](#8-garde-fous-et-conformité)  
9. [Processus d’implémentation](#9-processus-dimplémentation)  
10. [Critères d’acceptation et scénarios de test](#10-critères-dacceptation-et-scénarios-de-test)  
11. [Livrables et structure des fichiers](#11-livrables-et-structure-des-fichiers)  
12. [Risques et mitigations](#12-risques-et-mitigations)  
13. [Résumé exécutif](#13-résumé-exécutif)  
14. [Annexes et complétude du PRD](#14-annexes-et-complétude-du-prd)

---

## 1. Contexte et vision

### 1.1 Problème adressé

- Un trader qui veut s’appuyer sur plusieurs sources (technique, sentiment, smart money) doit tout agréger manuellement, sans format commun ni traçabilité.
- Un agent qui « décide » et exécute seul, sans garde-fous, conduit à des pertes (sur-trading, non-respect du risque, pas d’audit).
- Les idées de trade non structurées (entry, invalidation, targets, R:R, sources) ne sont pas reproductibles ni auditable.

### 1.2 Vision produit

**Trading Empire** est un système multi-agents intégré à OpenClaw qui :

- Produit des **idées de trades structurées, auditables et reproductibles** (format JSON normalisé).
- Maintient un **journal quotidien** (proposé / approuvé / refusé, avec raisons).
- Émet des **alertes** (brief, idées à valider, risque) via un **seul** canal (ex. Telegram).
- **N’exécute aucun ordre en V1** ; en V2, exécution uniquement sous contraintes strictes (stratégie figée, risque plafonné, audit, kill switch).

L’objectif est d’éviter le piège : laisser un agent décider et exécuter sans garde-fous.

### 1.3 Règle d’or

**Si une donnée est incertaine ou non vérifiable, elle est marquée `low_confidence` et ne peut pas déclencher à elle seule une idée de trade.**

- Toute source doit être citée (tweet id/url, exchange, API).
- Les agents ne doivent jamais affirmer une « certitude » ; ils parlent en probabilités et niveaux de confiance (0–1).
- Une idée sans invalidation claire, sans R:R minimum ou sans perte max calculée est invalide.

### 1.4 Principes de conception

| Principe | Application |
|----------|-------------|
| **Un seul Chef : le BOSS** | Un agent BOSS est le chef de tous les autres. Tous les agents se réfèrent à lui pour orientation, priorités, arbitrage et montée en charge. Aucune décision stratégique ou conflit ne contourne le BOSS. |
| **Tous les agents se connaissent et peuvent échanger** | Chaque agent connaît l’existence et le rôle des autres. Ils peuvent s’échanger des informations (demandes, réponses, signaux partiels) pour produire le résultat le plus pertinent. Les échanges sont tracés et exposés dans une section dédiée du dashboard. |
| **Séparation des rôles** | Collecte (capteurs) → Analyse (orchestrateur) → Décision (risk) → Exécution (V2 only). Aucun agent ne cumule « décider » et « exécuter ». |
| **Contrat de données unique** | Tous les échanges passent par des JSON normalisés (TRADE_IDEA, SIGNAL) pour permettre traçabilité et relecture. |
| **Règles non modifiables par les agents** | Les règles (risk, stratégie, exécution) sont des fichiers lus par les agents ; seuls les humains les modifient (via ticket/review). |
| **Un point de sortie utilisateur** | Une seule interface (ex. Telegram) branchée sur le BOSS / orchestrateur pour éviter le spam et la confusion. |
| **Paper first** | V1 = idées + journal + alertes ; exécution manuelle ou paper. Ajuster les règles avant toute automatisation. |

### 1.5 Objectifs par version

| Version | Objectif | Risque | Condition d’activation V2 |
|---------|-----------|--------|----------------------------|
| **V1** | Idées de trades + journal + alertes ; paper trading ou exécution manuelle. Aucun ordre envoyé par le système. | Faible (~20 %) | — |
| **V2** | Exécution automatique **uniquement si** : (1) stratégie figée (règles codifiées), (2) risque strict (max loss/jour, max positions, taille fixe), (3) audit complet (trace + raisons + données sources), (4) mode kill switch (désactivation instantanée). Agent EXECUTOR très bridé (passe les ordres, point). | Élevé si garde-fous absents | Décision explicite après phase paper et revue des règles. |

**Recommandation** : démarrer en V1 pour obtenir ~80 % de la valeur avec ~20 % du risque.

### 1.6 Parties prenantes et succès

| Partie prenante | Intérêt | Critère de succès |
|-----------------|--------|--------------------|
| **Trader / Opérateur** | Recevoir des idées structurées, un brief quotidien, un journal et des alertes sans être spammé. | 1 brief/jour lisible ; ≤ 5 idées/jour ; journal avec raisons de refus/approbation ; une seule notif (Telegram ou équivalent). |
| **Système OpenClaw** | Réutiliser le modèle « Agent Files » (identity, tasks, tools, memory) et la persistance dans `data/`. | Chaque agent a un dossier dédié ; les sorties sont dans `data/` avec noms et formats définis. |
| **Risque / Conformité** | Aucune exécution en V1 ; en V2, traçabilité complète et règles non modifiables par les agents. | Aucun ordre envoyé en V1 ; chaque idée et décision est tracée (fichiers + sources). |

### 1.7 Anti-objectifs (hors périmètre)

- Ne pas devenir un « bot de trading » qui trade en continu sans cadre.
- Ne pas laisser les agents modifier les règles de risque ou de stratégie.
- Ne pas exposer plusieurs canaux de notification (un seul point de sortie).
- Ne pas garantir un rendement ou une performance ; le produit fournit des **idées** et un **journal**, pas une exécution automatique non contrôlée.

---

## 2. Périmètre fonctionnel

### 2.1 In scope (V1) — détaillé

| Domaine | Élément | Détail |
|---------|---------|--------|
| **Agents** | 6 agents | **BOSS** (chef de tous ; référence unique) + ORCHESTRATOR, SENTIMENT_X, SMART_MONEY, TECHNICALS, RISK_JOURNAL. Chacun avec identity, agent, tasks, tools, memory. Tous se réfèrent au BOSS. |
| **Dashboard** | UI évolutive | TradeEmpire dispose d’un dashboard ; le BOSS (et les agents en Créations Nocturnes 1h–7h) l’améliore dans le cadre autorisé. |
| **Dashboard — Team** | Module | Tous les agents (nom, photo, skills), vue/édition des fichiers agent (agent.md, identity.md, memory.md, tasks.md…), APIs utilisées. |
| **Dashboard — TimeLine** | Module | Timeline de déploiement du projet ; étape vers trading automatisé ; Kanban (Board des tâches) pour amélioration continue. |
| **Dashboard — Wire** | Module | Trace des échanges entre agents (qui a demandé quoi à qui, réponses, contexte). |
| **Dashboard — Niches** | Module | Fiche structurée scorée par trade idea (macro, trend HTF, structure LTF, volume, funding, sentiment, OI, invalidation, R:R, score global) ; matrice décisionnelle. |
| **Dashboard — OpenClaw Intel** | Module | Scrape X, YouTube, tendances, outils, updates → classer, filtrer, proposer implémentation ; indispensable / borderline / rejeté ; boucle d’évolution autonome. |
| **Dashboard — Cost** | Module | Coûts fixes, coûts API, requêtes ; en trading : fees, funding payé, slippage, drawdown, ROI par stratégie. |
| **Dashboard — Besoins API** | Section | Chaque agent peut exprimer ses besoins en API ; le BOSS et l’opérateur peuvent y répondre. |
| **Créations Nocturnes** | Fenêtre 1h–7h | Agents peuvent créer modules, proposer améliorations, créer outils (dashboard, métriques, visualisations, Kanban) ; pas d’exécution critique ni modification des règles risk/stratégie/position sans validation. |
| **Contrat de données** | TRADE_IDEA.json | Format normalisé pour toute idée de trade (voir §4). |
| | SIGNAL.json (variantes) | Signaux techniques, sentiment, smart_money pour alimenter les idées. |
| **Workspace** | Arborescence | `trading-empire/` avec `rules/`, `memory/`, `data/`, `agents/`. |
| **Règles** | risk_rules.md | Max perte/trade et/jour, max trades/jour, max positions, leverage max, interdictions (martingale, moyenne à la baisse non prévue, etc.). |
| | strategy_rules.md | Setups autorisés, timeframes, symboles. |
| | execution_policy.md | Politique d’exécution (V1 = manuelle/paper ; V2 = conditions). |
| **Cadence** | Fenêtres quotidiennes | Morning brief (08:30), optionnel midday (13:00), evening recap (20:30). 2 à 3 fenêtres/jour max. |
| **Sorties** | Signaux | `data/signals/sentiment/`, `data/signals/smart_money/`, `data/signals/technicals/`. |
| | Idées | `data/ideas/` (fichiers TRADE_IDEA, status PROPOSED). |
| | Décisions | `data/decisions/` (APPROVED / REJECTED / NEED_MORE_INFO). |
| | Journal | `data/journal/` (brief, journal quotidien, post-mortem). |
| **Notification** | Canal unique | Un seul point (ex. Telegram) branché sur le BOSS / ORCHESTRATOR : daily brief, idées à valider, alertes risque. |
| **Exécution** | Aucune en V1 | Aucun ordre envoyé à un exchange par le système. |

### 2.2 Out of scope (V1) / prévu pour V2 ou ultérieur

| Élément | Raison |
|---------|--------|
| **EXECUTOR** | V2 uniquement ; agent très bridé qui ne fait que passer les ordres selon des plans déjà validés. |
| Exécution automatique sans stratégie figée, limites de risque strictes, audit et kill switch | Sécurité ; hors périmètre jusqu’à mise en place de ces garde-fous. |
| Modification des règles par les agents | Les règles sont lues uniquement ; toute modification passe par un ticket / review humain. |
| Plus de 3 fenêtres de scan par jour | Réduire le sur-trading et la charge. |
| Support d’actifs non définis dans la watchlist | Watchlist figée dans project.md / rules. |

### 2.3 Univers tradé

| Paramètre | Valeur |
|-----------|--------|
| **Actifs** | Crypto spot + perp (à préciser dans les règles : ex. Bybit/Binance, paires USDT). |
| **Watchlist** | BTC, ETH + jusqu’à 10 alts (liste définie dans `project.md`). Ex. : BTCUSDT, ETHUSDT, SOLUSDT, … |
| **Timeframes** | Au minimum 4H et 1D pour les signaux techniques (définis dans strategy_rules). |
| **Produits** | Spot et/ou perp selon configuration (execution_policy). |

### 2.4 Dépendances externes

- **OpenClaw** : mécanisme Agent Files (lecture identity, agent, tasks, tools, memory), cron/tâches planifiées, possibilité de notifier (ex. Telegram).
- **Données marché** : au moins un connecteur OHLCV (exchange) pour TECHNICALS.
- **Optionnel V1** : API X (ou flux manuel) pour SENTIMENT_X ; API funding/OI/liquidations pour SMART_MONEY.

---

## 3. Hiérarchie des agents : le BOSS et les 5 opérationnels

**Principe** : Un seul agent **BOSS** est le chef de tous les autres. Tous les agents (ORCHESTRATOR, SENTIMENT_X, SMART_MONEY, TECHNICALS, RISK_JOURNAL) se réfèrent à lui pour orientation, priorités, arbitrage en cas de conflit et montée en charge. Le BOSS ne trade jamais ; il pilote la stratégie globale, améliore le dashboard chaque nuit et consolide les besoins (dont les besoins API exprimés par les agents).

**Connaissance mutuelle et échanges** : **Tous les agents connaissent tous les agents** (rôle et capacité de chacun). Ils peuvent **échanger entre eux** (demandes d’information, réponses, signaux partiels) pour produire le **résultat le plus pertinent** — par exemple : TECHNICALS peut demander à SENTIMENT_X le sentiment sur un symbole avant de finaliser une idée ; ORCHESTRATOR peut demander à SMART_MONEY un point sur le funding avant consolidation. Ces échanges sont **tracés** et exposés dans la section « Échanges entre agents » du dashboard (voir §6).

---

### 3.1 BOSS (Chef — référence de tous les agents)

**Rôle** : Agent chef de tous les autres. Tous les agents se réfèrent à lui. Il fixe l’orientation et les priorités, arbitre les conflits, reçoit les remontées (dont les besoins API des agents), et améliore le dashboard chaque nuit en fonction des besoins identifiés.

**Entrées** :
- Remontées des 5 agents (orchestrator, sentiment_x, smart_money, technicals, risk_journal) : rapports, alertes, **besoins API** (section dédiée du dashboard).
- État du dashboard actuel et historique des améliorations.
- Règles lues depuis `rules/` (vision stratégique, pas d’exécution).

**Comportement** :
- Ne trade jamais ; ne valide pas les trades (RISK_JOURNAL) ; ne consolide pas les signaux à la place de l’orchestrateur (ORCHESTRATOR). Il **pilote** et **arbitre**.
- Reçoit les références de tous les agents : orientation, priorités, escalade en cas de blocage ou conflit.
- **Chaque nuit** : analyse les besoins du jour (y compris la section « Besoins API » du dashboard), décide des améliorations du dashboard (nouvelles vues, métriques, alertes, UX) et produit une version mise à jour du dashboard (spec ou config) pour le lendemain.
- Peut demander à l’ORCHESTRATOR d’ajuster la cadence ou les priorités (watchlist, fenêtres) selon les retours.
- Consulte la section « Besoins API » : chaque agent peut y exprimer un besoin d’API ; le BOSS synthétise et priorise pour l’opérateur (humain) ou pour une roadmap d’outils.

**Sorties** :
- Orientations et décisions communiquées aux agents (via mémoire partagée, brief, ou config lue par les agents).
- **Dashboard mis à jour** : chaque nuit, sortie vers `dashboard/` ou config du dashboard (voir §6).
- Synthèse des besoins API (optionnel : fichier ou entrée dashboard pour l’opérateur).

**Interdits** :
- Ne jamais exécuter un trade ni valider une idée à la place de RISK_JOURNAL.
- Ne pas remplacer l’ORCHESTRATOR sur la consolidation des signaux et la production des idées ; il pilote, ne fait pas le travail opérationnel à sa place.

**Référence des autres agents vers le BOSS** : Tous les agents connaissent le BOSS comme autorité de référence ; en cas de doute sur priorité, conflit de règle ou besoin (ex. API manquante), ils remontent au BOSS ou déposent leur besoin dans la section prévue (Besoins API).

**Fichiers agent** : `agents/boss/identity.md`, `agent.md`, `tasks.md`, `tools.md`, `memory.md`.

---

### 3.2 ORCHESTRATOR (Coordination opérationnelle — sous le BOSS)

**Rôle** : Planifier le travail des autres agents, consolider les signaux, produire le daily brief, dispatcher les idées vers RISK_JOURNAL, maintenir la traçabilité (wire logique). Il exécute sous l’orientation du BOSS.

**Se réfère au BOSS pour** : priorités (watchlist, fenêtres), arbitrage si conflit entre signaux ou agents, orientation stratégique ; remonte les blocages et les demandes d’évolution (dont besoins API si l’orchestrateur en identifie).

**Entrées** :
- Fichiers produits par TECHNICALS, SENTIMENT_X, SMART_MONEY dans `data/signals/`.
- Règles lues depuis `rules/` (strategy_rules, risk_rules pour cohérence des idées).
- Orientations du BOSS (priorités, cadence si ajustée).

**Comportement** :
- Ne trade jamais ; ne valide jamais un trade (seul RISK_JOURNAL décide APPROVE/REJECT/NEED_MORE_INFO).
- Demande explicitement aux agents des sorties JSON (via tasks décrites dans tasks.md).
- Déclenche les tâches selon la cadence (cron) : après les scans Technicals, Sentiment, Smart money, il compile les signaux et produit 3 à 7 idées max par fenêtre.
- Produit un « daily brief » résumant signaux + idées proposées + décisions (après passage par Risk).
- Envoie vers le canal de notification : brief, idées à valider, alertes risque (si défini).

**Sorties** :
- `data/journal/{date}_brief.md` (résumé du jour).
- `data/ideas/*.json` (idées consolidées, status PROPOSED, envoyées à Risk pour décision).

**Interdits** :
- Ne jamais valider ou rejeter une idée à la place de RISK_JOURNAL.
- Ne jamais proposer une idée sans invalidation, R:R ou perte max.
- Ne pas dépasser le nombre max d’idées par jour (ex. 5).

**Fichiers agent** : `agents/orchestrator/identity.md`, `agent.md`, `tasks.md`, `tools.md`, `memory.md`.

---

### 3.3 SENTIMENT_X (Crypto-Twitter)

**Rôle** : Surveiller X (crypto-twitter) et extraire narratifs dominants, pics d’engagement, sentiment (bullish/bearish) par actif, signaux de risque (rug, hack, insolvabilité, fake news).

**Se réfère au BOSS pour** : priorité des symboles ou sources à traiter, escalade si API X indisponible ou limite atteinte ; peut exprimer un **besoin en API** (ex. API X officielle) dans la section dédiée du dashboard.

**Entrées** :
- Flux X (API ou outil de collecte) ou, en fallback V1, digest manuel / fichier fourni.
- Watchlist (symboles à surveiller).

**Comportement** :
- Citer systématiquement les sources (tweet id ou URL).
- Résumer en points vérifiables ; marquer l’incertitude (low_confidence si source douteuse).
- Détecter les manipulations évidentes (shills, bots, comptes très récents) et les signaler sans les traiter comme vérité.
- Ne jamais transformer un tweet en vérité factuelle ; ne jamais recommander un trade uniquement sur sentiment.
- Produire des SIGNAL sentiment (voir §4) qui alimenteront les idées côté Orchestrator.

**Sorties** :
- `data/signals/sentiment/{date}_x_digest.json` (digest global du jour).
- `data/signals/sentiment/{symbol}_{timestamp}.json` (sentiment par symbole si pertinent).

**Interdits** :
- Ne pas inventer de tweets ou de métriques d’engagement.
- Ne pas conclure « buy » ou « sell » sur la seule base du sentiment.

**Fichiers agent** : `agents/sentiment_x/identity.md`, `agent.md`, `tasks.md`, `tools.md`, `memory.md`.

---

### 3.4 SMART_MONEY (Copy / Top traders / Wallets)

**Rôle** : Suivre des sources observables : top traders (si API dispo), wallets publics / flows on-chain (si dispo), funding / OI / liquidations (si dispo).

**Se réfère au BOSS pour** : priorité des métriques ou sources ; peut exprimer un **besoin en API** (ex. funding, OI, liquidations, on-chain) dans la section dédiée du dashboard lorsqu’il considère en avoir besoin.

**Entrées** :
- APIs ou données on-chain / exchange (funding, OI, liquidations, flows).
- Watchlist.

**Comportement** :
- Toujours préciser la source et ses limites (ex. « funding Bybit 4h », « whale netflow Glassnode »).
- Produire des signaux exploitables : ex. « whale netflow + », « OI spikes », « funding élevé ».
- Ne pas inventer de données on-chain ; ne pas conclure si la donnée est partielle (marquer low_confidence si besoin).

**Sorties** :
- `data/signals/smart_money/{symbol}_{timestamp}.json` (un fichier par symbole et timestamp de scan).

**Interdits** :
- Ne pas affirmer des flux ou des positions sans source identifiable.
- Ne pas recommander un trade sur la seule base smart money.

**Fichiers agent** : `agents/smart_money/identity.md`, `agent.md`, `tasks.md`, `tools.md`, `memory.md`.

---

### 3.5 TECHNICALS (Charts)

**Rôle** : Générer des signaux techniques objectifs sur la watchlist ; proposer niveaux (trend, support/resistance, structure, volatilité) ; produire un JSON normalisé par symbole/timeframe.

**Se réfère au BOSS pour** : watchlist ou timeframes à prioriser ; peut exprimer un **besoin en API** (ex. OHLCV temps réel, autre exchange) dans la section dédiée du dashboard si nécessaire.

**Entrées** :
- OHLCV (chandeliers) depuis connecteur exchange pour les symboles et timeframes définis (ex. 4H, 1D).
- strategy_rules pour les setups autorisés (ex. breakout_retest, range, etc.).

**Comportement** :
- Calculer : trend (MA/structure), ATR ou volatilité, niveaux clés, breakouts, range.
- Pointer ce qui invalide un setup (niveau à casser, structure à invalider).
- Donner une confiance chiffrée 0–1 basée sur des critères explicites.
- Ne pas inventer de données ; ne pas donner de « certitudes » (toujours en probabilités).
- Ne pas proposer d’exécution sans passer par RISK (les idées techniques sont des propositions, pas des ordres).

**Sorties** :
- `data/signals/technicals/{symbol}_{tf}_{timestamp}.json` (ex. BTCUSDT_4h_20260301121500.json).
- Optionnellement, si tous les éléments sont présents pour une idée complète (entry, invalid, targets, risk), écrire dans `data/ideas/` (idée PROPOSED).

**Interdits** :
- Ne pas utiliser de données non fournies par les outils (pas d’invention de prix ou de volume).
- Ne pas dépasser le cadre des timeframes et symboles de la watchlist.

**Fichiers agent** : `agents/technicals/identity.md`, `agent.md`, `tasks.md`, `tools.md`, `memory.md`.

---

### 3.6 RISK_JOURNAL (Risk & Journal)

**Rôle** : Vérifier chaque TRADE_IDEA (conformité risk_rules, cohérence entry/invalid/targets, absence de contradictions), décider APPROVE / REJECT / NEED_MORE_INFO, rédiger le journal quotidien.

**Se réfère au BOSS pour** : arbitrage en cas de conflit d’interprétation des règles, escalade si règle ambiguë ; peut exprimer un **besoin en API** (ex. données risque, position) dans la section dédiée du dashboard si pertinent.

**Entrées** :
- Fichiers TRADE_IDEA dans `data/ideas/` (status PROPOSED).
- `rules/risk_rules.md`, `rules/strategy_rules.md`.

**Comportement** :
- Pour chaque idée : vérifier conformité aux risk_rules (max perte, max positions, leverage, interdictions), cohérence entry/invalid/targets (prix, R:R), absence de contradiction avec les règles.
- Décider : APPROVE (conforme, peut être exécutée manuellement ou en V2 par Executor), REJECT (règle violée ou incohérence), NEED_MORE_INFO (données manquantes ou ambiguës).
- Écrire le journal quotidien : ce qui a été proposé, ce qui a été refusé/approuvé, et pourquoi.
- Pouvoir refuser sans discussion si une règle est violée (pas de négociation avec l’orchestrateur).

**Sorties** :
- `data/decisions/{trade_id}_{status}.json` (status = APPROVED | REJECTED | NEED_MORE_INFO) avec raison si rejet ou need_more_info.
- `data/journal/{date}.md` (journal du jour avec résumé des idées et décisions).

**Interdits** :
- Ne pas approuver une idée qui viole risk_rules ou strategy_rules.
- Ne pas modifier les règles ; seulement les lire et les appliquer.

**Fichiers agent** : `agents/risk_journal/identity.md`, `agent.md`, `tasks.md`, `tools.md`, `memory.md`.

---

### 3.7 Matrice des responsabilités

| Responsabilité | BOSS | ORCHESTRATOR | SENTIMENT_X | SMART_MONEY | TECHNICALS | RISK_JOURNAL |
|----------------|------|--------------|-------------|-------------|------------|--------------|
| Chef / référence de tous | **Oui** | — | — | — | — | — |
| Améliorer le dashboard (chaque nuit) | **Oui** | — | — | — | — | — |
| Consulter / prioriser besoins API | **Oui** | — | — | — | — | — |
| Collecte données | — | — | X (X) | X (on-chain / funding) | X (OHLCV) | — |
| Produire signaux | — | — | Oui | Oui | Oui | — |
| Consolider idées | — | Oui | — | — | (optionnel) | — |
| Valider / refuser idée | — | Non | Non | Non | Non | Oui |
| Écrire journal | — | Brief | — | — | — | Journal quotidien |
| Notifier l’utilisateur | (via orient.) | Oui (canal) | Non | Non | Non | Non |
| Exprimer besoin API (dashboard) | — | Oui | Oui | Oui | Oui | Oui |
| Échanger avec les autres agents (demande/réponse) | Oui | Oui | Oui | Oui | Oui | Oui |
| Écrire dans section Échanges (dashboard) | — | Oui | Oui | Oui | Oui | Oui |

---

## 4. Modèle de données et contrats

### 4.1 Format universel : TRADE_IDEA.json

Toute idée de trade échangée entre agents et stockée dans `data/ideas/` ou `data/decisions/` respecte ce schéma (ou un sous-ensemble cohérent).

**Champs** :

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `timestamp_utc` | string (ISO 8601) | Oui | Horodatage de création de l’idée. |
| `symbol` | string | Oui | Ex. BTCUSDT, ETHUSDT. |
| `timeframe` | string | Oui | Ex. 4H, 1D. |
| `direction` | string | Oui | LONG \| SHORT. |
| `setup_name` | string | Oui | Ex. breakout_retest, range, etc. (aligné strategy_rules). |
| `entry` | object | Oui | `{ "type": "limit" \| "market", "price"?: number }`. |
| `invalid` | object | Oui | Invalidation : `{ "type": "price" \| "structure" \| "time", "price"?: number, "description"?: string }`. |
| `targets` | array | Oui | `[{ "price": number, "rr": number }, ...]`. R:R minimum respecté (défini dans rules). |
| `confidence` | number | Oui | Entre 0 et 1. |
| `evidence` | object | Oui | `{ "technicals": string[], "sentiment": string[], "smart_money": string[] }`. |
| `risk` | object | Oui | `{ "max_loss_usd": number, "position_size_usd": number, "leverage": number }`. |
| `constraints` | object | Optionnel | Ex. max_positions_open, no_trade_if_funding_gt. |
| `sources` | array | Oui | `[{ "type": string, "ref": string }, ...]` (tweet url, exchange, API). |
| `status` | string | Oui | PROPOSED \| APPROVED \| REJECTED \| NEED_MORE_INFO. |
| `trade_id` | string | Si décision | Identifiant unique pour lier idée et décision. |

**Exemple complet** :

```json
{
  "timestamp_utc": "2026-03-01T12:30:00Z",
  "symbol": "BTCUSDT",
  "timeframe": "4H",
  "direction": "LONG",
  "setup_name": "breakout_retest",
  "entry": { "type": "limit", "price": 62000 },
  "invalid": { "type": "price", "price": 60600 },
  "targets": [
    { "price": 63500, "rr": 1.2 },
    { "price": 66000, "rr": 2.4 }
  ],
  "confidence": 0.63,
  "evidence": {
    "technicals": ["range breakout", "volume expansion", "higher low"],
    "sentiment": ["narrative: ETF inflow", "X sentiment positive"],
    "smart_money": ["whale netflow positive"]
  },
  "risk": {
    "max_loss_usd": 50,
    "position_size_usd": 500,
    "leverage": 1
  },
  "constraints": {
    "max_positions_open": 3,
    "no_trade_if_funding_gt": 0.02
  },
  "sources": [
    { "type": "x", "ref": "tweet_id_or_url" },
    { "type": "exchange", "ref": "bybit_candles_4h" }
  ],
  "status": "PROPOSED"
}
```

**Règles de validation** :
- Toute idée doit contenir : invalidation claire, R:R minimum (défini dans risk_rules), taille de position et perte max calculée.
- Si un champ obligatoire manque ou est incohérent (ex. entry > invalid en LONG), RISK_JOURNAL doit rejeter ou NEED_MORE_INFO.

---

### 4.2 Signaux (SIGNAL) — formats par type

Les agents « capteurs » produisent des signaux qui alimentent les idées. Format générique : un JSON par type avec timestamp, symbol (si pertinent), et données spécifiques.

**Technicals** — `data/signals/technicals/{symbol}_{tf}_{timestamp}.json` :

- `timestamp_utc`, `symbol`, `timeframe`
- `trend`: "up" | "down" | "range"
- `levels`: { "support": number[], "resistance": number[] }
- `volatility`: number (ex. ATR ou indicateur)
- `setup_candidates`: [{ "name": string, "entry": number, "invalid": number, "targets": number[], "confidence": number }]
- `sources`: [{ "type": "exchange", "ref": string }]

**Sentiment** — `data/signals/sentiment/{date}_x_digest.json` ou `{symbol}_{timestamp}.json` :

- `timestamp_utc`, `date` (YYYY-MM-DD)
- `narratives`: string[]
- `sentiment_by_symbol`: { [symbol]: "bullish" | "bearish" | "neutral" }
- `risk_signals`: string[] (rug, hack, fake news, etc.)
- `sources`: [{ "type": "x", "ref": string }]
- `low_confidence`: boolean (si sources douteuses)

**Smart money** — `data/signals/smart_money/{symbol}_{timestamp}.json` :

- `timestamp_utc`, `symbol`
- `signals`: string[] (ex. "whale netflow +", "OI spike")
- `metrics`: { "funding"?: number, "open_interest"?: number, ... }
- `sources`: [{ "type": string, "ref": string }]
- `low_confidence`: boolean si donnée partielle

---

### 4.3 Décision — `data/decisions/{trade_id}_{status}.json`

Contenu typique :
- `trade_id`, `status`: APPROVED | REJECTED | NEED_MORE_INFO
- `timestamp_utc`
- `reason`: string (obligatoire si REJECTED ou NEED_MORE_INFO)
- Copie ou référence à l’idée d’origine (idéalement `idea_trade_id` ou chemin vers le TRADE_IDEA).

---

### 4.4 Journal — `data/journal/{date}.md` et `{date}_brief.md`

- **Brief** (`{date}_brief.md`) : résumé du jour (signaux marquants, idées proposées, décisions). Produit par ORCHESTRATOR.
- **Journal** (`{date}.md`) : détail des idées proposées, approuvées, refusées, avec raisons. Produit par RISK_JOURNAL. Peut inclure un court post-mortem (même sans trade).

---

### 4.5 Règles de risque (contenu attendu de risk_rules.md)

- **Max perte par trade** : X USD  
- **Max perte par jour** : Y USD  
- **Max trades par jour** : N  
- **Max positions ouvertes** : M  
- **Leverage max** : L  
- **Interdictions** : pas de martingale ; pas de moyenne à la baisse (sauf stratégie explicitement définie) ; pas de trade si volatilité extrême (règle objective à définir) ; pas de trade pendant news macro (optionnel).  
- **Exigences sur toute idée** : invalidation claire, R:R minimum, taille de position et perte max calculée.

Les valeurs X, Y, N, M, L sont à définir dans le fichier (ex. 50, 150, 5, 3, 2).

---

### 4.6 Strategy rules et execution policy

- **strategy_rules.md** : Setups autorisés (ex. breakout_retest, range), timeframes (4H, 1D), symboles (watchlist). Tout setup ou symbole non listé ne doit pas donner lieu à une idée validée.
- **execution_policy.md** : En V1, exécution manuelle ou paper uniquement ; en V2, conditions sous lesquelles l’EXECUTOR peut envoyer des ordres (stratégie figée, risque strict, audit, kill switch).

---

## 5. Cadence, cron et enchaînement

### 5.1 Timezone et fenêtres

- Timezone de référence : à définir (ex. Europe/Paris). Toutes les heures sont exprimées dans cette timezone sauf si indiqué (UTC).
- **3 fenêtres possibles** : Morning (08:xx), Midday (13:xx), Evening (20:xx). En V1, au moins 2 fenêtres (ex. morning + evening) pour limiter le sur-trading.

### 5.2 Séquence type (morning)

| Ordre | Heure | Agent / étape | Action | Dépendances |
|-------|--------|----------------|--------|-------------|
| 1 | 08:15 | TECHNICALS | Scan 4H + 1D sur toute la watchlist. Écriture dans `data/signals/technicals/`. | OHLCV disponible |
| 2 | 08:25 | SMART_MONEY | Scan funding / OI / flows (si connecteurs dispo). Écriture dans `data/signals/smart_money/`. | APIs dispo |
| 3 | 08:35 | SENTIMENT_X | Digest X (narratifs + risques). Écriture dans `data/signals/sentiment/`. | Flux X ou manuel |
| 4 | 08:45 | ORCHESTRATOR | Lecture des signaux, consolidation, production de 3 à 7 idées max. Écriture dans `data/ideas/`, status PROPOSED. | 1, 2, 3 terminés |
| 5 | 08:55 | RISK_JOURNAL | Lecture des idées PROPOSED, vérification risk_rules et cohérence, décision APPROVE/REJECT/NEED_MORE_INFO. Écriture dans `data/decisions/`. | 4 terminé |
| 6 | 09:00 | ORCHESTRATOR | Génération du brief du matin, envoi notification (brief + idées à valider + alertes risque). | 5 terminé |

### 5.3 Evening (recap + journal)

| Heure | Agent | Action |
|--------|--------|--------|
| 20:30 | RISK_JOURNAL | Rédaction du journal quotidien `data/journal/{date}.md` (résumé des idées, décisions, raisons). Post-mortem même sans trade. |
| 20:35 | ORCHESTRATOR | Mise à jour ou création du brief soir si besoin ; optionnel envoi récap. |

### 5.4 Gestion des échecs et retries

- Si un agent « capteur » (Technicals, Sentiment, Smart money) échoue : ne pas bloquer toute la chaîne ; l’orchestrateur peut compiler avec les signaux disponibles et marquer les idées concernées avec moins de preuves ou low_confidence.
- Si ORCHESTRATOR échoue : pas de nouvelles idées pour cette fenêtre ; la suivante reprend normalement.
- Si RISK_JOURNAL échoue : les idées restent en PROPOSED ; une ré-exécution manuelle ou au prochain cron peut traiter les idées en attente.
- Retry : recommandation 1 retry avec backoff court (ex. 2 min) par tâche avant de passer à l’étape suivante ou de marquer la fenêtre en échec partiel (log + optionnel alerte).

### 5.5 Limite d’idées par jour

- Max idées proposées par jour : ex. 5 (configurable dans project.md ou risk_rules). Une fois la limite atteinte, l’orchestrateur ne produit plus de nouvelles idées jusqu’au lendemain.

### 5.6 Créations Nocturnes (1h–7h) — BOSS et agents

| Fenêtre | Agent(s) | Action |
|---------|----------|--------|
| **1h–7h** (configurable) | BOSS + agents (autonomie encadrée) | **Créations Nocturnes** : le BOSS lit dashboard, échanges, Besoins API, Intel, Kanban ; produit des améliorations (spec/config) pour le dashboard, nouvelles métriques, visualisations. Les agents peuvent proposer des modules, améliorations, tâches Kanban. **Interdit** : exécution critique, modification des règles (risk, stratégie, taille position) sans validation humaine. Voir §6.10. |
| 01:00 (exemple) | BOSS | Tâche dédiée : synthèse des besoins, amélioration du dashboard (spec/config), priorisation Besoins API, lecture section Wire et Intel. Écriture dans `dashboard/config/`, `dashboard/spec/`. |

---

## 6. Dashboard (modules et évolutivité)

TradeEmpire dispose d’un **dashboard** : interface unique pour visualiser l’état du système, les signaux, les idées, les décisions, le journal, l’équipe d’agents, la roadmap, les coûts et l’intel. Le dashboard est **évolutif** : le BOSS (et les agents pendant les Créations Nocturnes, dans le cadre autorisé) l’améliore chaque nuit. Il comporte les **modules** suivants.

### 6.1 Vue d’ensemble des modules

| Module | Objectif |
|--------|----------|
| **Team** | Afficher tous les agents (nom, photo, skills), voir/éditer leurs fichiers agent (agent.md, identity.md, memory.md, tasks.md…), et les API qu’ils utilisent. |
| **TimeLine** | Timeline de déploiement du projet ; étape actuelle vers le trading automatisé ; Board des tâches (Kanban) pour amélioration continue. |
| **Wire** | Retracer les échanges entre agents (déjà décrit : qui a demandé quoi à qui, réponses, contexte). |
| **Niches** | Transformer chaque trade idea en fiche structurée scorée (matrice décisionnelle) : contexte macro, trend HTF, structure LTF, volume, funding, sentiment, concurrence/OI, invalidation, R:R, score global. |
| **OpenClaw Intel** | Scraper X, YouTube, tendances, outils, updates → classer, filtrer, proposer implémentation ; distinguer indispensable / borderline (validation requise) / rejeté. Boucle d’évolution autonome (narratifs, régulations, métriques on-chain, indicateurs). |
| **Cost** | Suivre coûts fixes, coûts API, requêtes utilisées, projections ; en trading : fees, funding payé, slippage, drawdown, ROI par stratégie. Rendre le système mesurable. |
| **Besoins API** | Section où chaque agent exprime ses besoins en API ; le BOSS et l’opérateur peuvent y répondre. |

### 6.2 Évolutivité — le BOSS améliore le dashboard chaque nuit

- **Cadence** : chaque nuit (ex. 01:00), le BOSS exécute une tâche dédiée (voir §5.6).
- **Entrées pour le BOSS** : état actuel du dashboard (config, vues, métriques), **section Échanges entre agents** (pour analyser les patterns d’échange et les besoins d’UX), section **Besoins API** (demandes des agents), éventuels retours ou logs d’usage (quelles vues sont consultées, quels besoins reviennent).
- **Comportement** : le BOSS analyse les besoins (manques de données, UX, nouvelles métriques, alertes) et produit une **version améliorée** du dashboard pour le lendemain : nouvelles vues, nouveaux champs, réorganisation, ou recommandations pour l’opérateur (ex. « ajouter une API funding pour SMART_MONEY »).
- **Sorties** : mise à jour de la config ou des specs du dashboard (fichiers dans `dashboard/` ou base de config). L’implémentation concrète (code front) peut être manuelle ou automatisée selon l’outillage ; le BOSS produit au minimum la **spécification** des changements (quoi afficher, où, d’où viennent les données).

**Règle** : les agents ne modifient pas directement le code du dashboard ; le BOSS propose des améliorations (spec / config), l’humain ou un pipeline peut les appliquer.

### 6.3 Module « Team » (équipe d’agents)

- **Objectif** : Afficher tous les agents du système avec une fiche par agent, et permettre de voir et éditer leurs fichiers agent ainsi que les API qu’ils utilisent.
- **Contenu par agent** :
  - **Nom** de l’agent (ex. BOSS, ORCHESTRATOR, SENTIMENT_X, SMART_MONEY, TECHNICALS, RISK_JOURNAL).
  - **Photo** (avatar ou icône) — configurable par agent (chemin ou URL).
  - **Skills particulières** : compétences ou domaines (ex. « Signaux techniques », « Sentiment X », « Risk & conformité »).
  - **Fichiers agent** : accès en lecture et **édition** à tous les fichiers du dossier `agents/<name>/` : `agent.md`, `identity.md` (ou `soul.md` si utilisé), `memory.md`, `tasks.md`, `tools.md`, etc. L’opérateur peut modifier ces fichiers depuis le dashboard (éditeur intégré ou lien vers le fichier).
  - **API qu’ils utilisent** : liste des APIs / connecteurs utilisés par cet agent (ex. « OHLCV Bybit », « API X », « Funding Bybit »). Alimenté par la config ou par les tools.md ; peut être croisé avec la section Besoins API (demandes en cours).
- **Données** : lecture depuis la structure `agents/<name>/*.md` et une config optionnelle (nom affiché, photo, skills) dans `dashboard/config/team.json` ou équivalent.

### 6.4 Module « TimeLine » (déploiement et Kanban)

- **Objectif** : Montrer la **timeline de déploiement** du projet complet — à quelle étape on en est pour atteindre le **trading automatisé** — et fournir un **Board des tâches (Kanban)** pour une mécanique d’amélioration continue.
- **TimeLine de déploiement** :
  - Étapes type : V1 Paper (idées + journal) → Connexion exchange OHLCV → Signaux complets (technicals + sentiment + smart money) → Risk validé → Dashboard opérationnel → V2 Exécution (si décision) → Trading automatisé encadré.
  - Affichage : barre ou jalonnement indiquant l’étape actuelle et les étapes restantes ; objectif = visibilité sur la route vers l’automatisation réelle.
- **Kanban (Board des tâches)** :
  - Colonnes type : **À faire** | **En cours** | **En revue** | **Fait** (ou variante).
  - Les tâches peuvent être créées par l’opérateur, par le BOSS (pendant les Créations Nocturnes), ou par les agents (propositions d’amélioration). Chaque carte = une tâche (titre, description, priorité, lien vers module ou fichier).
  - Usage : backlog d’amélioration continue (nouvelles métriques, correctifs, intégrations API, améliorations dashboard). Données dans `data/dashboard/kanban.json` ou base dédiée.

### 6.5 Module « Wire » (échanges entre agents)

- **Objectif** : Le dashboard contient une section qui **garde** (persiste) et **affiche** les échanges entre agents. Tous les agents connaissent tous les agents et peuvent s’échanger des informations pour obtenir le résultat le plus pertinent ; ces échanges sont enregistrés et visibles.
- **Contenu** : Pour chaque échange : émetteur (agent source), destinataire(s) (agent(s) cible), type (demande / réponse / partage de signal), horodatage, contexte (ex. symbol, trade_id, fenêtre du jour), et contenu ou référence au contenu (résumé, lien vers fichier signal/idée, etc.).
- **Usage** :
  - **Traçabilité** : l’opérateur et le BOSS peuvent suivre qui a demandé quoi à qui et pourquoi (audit, debug, amélioration des flux).
  - **Collaboration** : les agents sont censés utiliser ces échanges pour affiner leurs sorties (ex. TECHNICALS demande à SENTIMENT_X un avis sur BTC avant de proposer une idée ; RISK_JOURNAL peut demander une précision à ORCHESTRATOR).
- **Persistance** : chaque échange est écrit dans un store dédié (fichier `data/dashboard/agent_exchanges.json` ou équivalent, ou base) avec un format normalisé (voir §6.12). Le dashboard affiche le module **Wire** à partir de ce store (fil chronologique, filtrage par agent, par date, par contexte).
- **Règle** : les agents n’effacent pas les échanges ; l’archivage ou la rétention (ex. 30 jours en détail) est gérée par config ou processus humain.

### 6.6 Module « Niches » (fiche structurée scorée par trade idea)

- **Objectif** : Transformer chaque **trade idea** en **fiche structurée scorée** — une matrice décisionnelle pour évaluer et comparer les idées.
- **Champs par trade idea** (fiche Niches) :
  - **Contexte macro** : résumé macro (optionnel, si disponible).
  - **Trend HTF** (higher timeframe) : tendance cadre haut (ex. 1D).
  - **Structure LTF** (lower timeframe) : structure court terme (ex. 4H).
  - **Volume** : niveau / évolution du volume.
  - **Funding** : funding rate (si dispo).
  - **Sentiment** : résumé sentiment (X, narratifs).
  - **Concurrence (OI)** : open interest, concurrence positionnement.
  - **Invalidation** : niveau ou règle d’invalidation.
  - **R:R** : risk-reward.
  - **Score global** : score agrégé (ex. 0–100 ou 0–1) calculé à partir des critères ci-dessus.
- **Source** : les champs sont alimentés à partir du TRADE_IDEA.json et des signaux (technicals, sentiment, smart_money). Le module Niches peut être enrichi par un agent dédié ou par l’ORCHESTRATOR qui produit une **fiche Niches** par idée (fichier `data/dashboard/niches/{trade_id}.json` ou entrée dans une base).
- **Affichage** : tableau ou cartes par idée avec tous les critères et le score global ; tri/filtre par score, symbole, date.

### 6.7 Module « OpenClaw Intel » (veille et proposition d’implémentation)

- **Objectif** : Boucle d’évolution autonome — scraper des sources externes, classer, filtrer et proposer des implémentations ; distinguer ce qui est indispensable, borderline (validation requise) ou rejeté.
- **Sources scrapées** :
  - **X** (Twitter) : narratifs, annonces, sentiment.
  - **YouTube** : analyses, tutos, annonces.
  - **Tendances** : sujets tendance (crypto, régulations, outils).
  - **Outils** : nouveaux outils, APIs, indicateurs.
  - **Updates** : mises à jour (exchanges, protocoles, régulations).
- **Traitement** : après collecte → **classer** (catégorie : narratif, régulation, métrique on-chain, indicateur, outil…) → **filtrer** (pertinence pour TradeEmpire) → **proposer implémentation** (suggestion d’intégration ou d’usage).
- **Classification de sortie** :
  - **Indispensable** : à intégrer ou traiter en priorité.
  - **Borderline** : validation humaine requise avant action.
  - **Rejeté** : non pertinent ou hors périmètre.
- **Usage stratégique** : Intel peut surveiller nouveaux narratifs, nouvelles régulations, nouvelles métriques on-chain, nouveaux indicateurs — et alimenter le dashboard (et le BOSS) pour décisions d’évolution. Données : `data/dashboard/intel/` (items scrapés, classification, propositions).

### 6.8 Module « Cost » (coûts et métriques trading)

- **Objectif** : Suivre les **coûts** et métriques financières pour rendre le système **mesurable** ; en trading : fees, funding payé, slippage, drawdown, ROI par stratégie.
- **Suivi** :
  - **Coûts fixes** : abonnements, infra.
  - **Coûts API** : coût des APIs utilisées (si facturées).
  - **Requêtes utilisées** : volume de requêtes par API (pour respect des limites et coût).
  - **Projections** : projection des coûts (optionnel).
- **En trading** :
  - **Fees** : frais d’exécution (trades passés ou simulés).
  - **Funding payé** : funding payé/reçu (perp).
  - **Slippage** : écart entre prix attendu et exécution.
  - **Drawdown** : drawdown (capital ou par stratégie).
  - **ROI par stratégie** : performance par type de stratégie ou par symbole.
- **Données** : `data/dashboard/costs.json` ou base ; alimentation manuelle ou automatique (depuis exchange / logs). Le module Cost affiche tableaux et graphiques (évolution des coûts, PnL, drawdown, ROI).

### 6.9 Section « Besoins API » (chaque agent peut exprimer ses besoins)

- **Emplacement** : une section dédiée du dashboard, lisible par l’opérateur et par le BOSS.
- **Contenu** : chaque agent peut **déposer** un besoin en API lorsqu’il considère en avoir besoin (ex. SENTIMENT_X : « API X officielle pour éviter le scraping » ; SMART_MONEY : « API funding/OI Bybit » ; TECHNICALS : « OHLCV temps réel 1m »).
- **Format** : un enregistrement par besoin (ou fichier JSON partagé), avec au minimum :
  - `agent_id` : qui demande (SENTIMENT_X, SMART_MONEY, TECHNICALS, etc.)
  - `api_description` : description de l’API ou de la donnée souhaitée
  - `reason` : pourquoi l’agent en a besoin (ex. « signaux partiels sans funding »)
  - `priority` : optionnel, priorité self-assignée par l’agent (ex. high / medium / low)
  - `timestamp_utc` : date de la demande
  - `status` : optionnel, pour suivi (e.g. REQUESTED | IN_PROGRESS | DONE | REJECTED), mis à jour par l’opérateur ou le BOSS.

**Flux** :
1. Un agent détecte un manque (ex. pas d’API X, pas de funding) et écrit une entrée dans la section Besoins API (fichier `data/dashboard/api_requests.json` ou équivalent, ou entrée en base).
2. Le dashboard affiche ces demandes dans la section « Besoins API ».
3. Le BOSS, chaque nuit, lit cette section, la synthétise et peut : (a) prioriser pour l’opérateur, (b) inclure ces besoins dans ses recommandations d’amélioration du dashboard ou de la roadmap outils.
4. L’opérateur (humain) peut décider d’implémenter une API, de la refuser ou de la planifier ; le statut est mis à jour pour que les agents voient que le besoin est pris en compte.

### 6.10 Créations Nocturnes (autonomie encadrée, 1h–7h)

- **Fenêtre** : Entre **1h et 7h** (configurable), les agents peuvent exercer une **autonomie encadrée** : créer des modules, proposer des améliorations, créer des outils.
- **Autorisé pendant les Créations Nocturnes** :
  - **Amélioration du dashboard** : nouvelles vues, métriques, visualisations (spec ou config proposées par le BOSS ou les agents).
  - **Nouvelles métriques** : proposition de métriques à ajouter (Niches, Cost, Intel).
  - **Nouvelles visualisations** : propositions d’affichage (graphiques, tableaux).
  - **Propositions d’outils** : idées de nouveaux connecteurs ou modules (soumis en Besoins API ou Kanban).
  - **Tâches Kanban** : création de cartes « À faire » pour amélioration continue (à valider par l’opérateur).
- **Interdit (sans validation humaine)** :
  - **Pas d’exécution critique** : aucun ordre de trade, aucune action irréversible sur les fonds.
  - **Pas de modification des règles** sans validation : pas de modification de `risk_rules.md`, `strategy_rules.md`, `execution_policy.md`.
  - **En trading, déconseillé d’autoriser** : modification de la stratégie, modification du risk, modification de la taille de position — ces changements restent sous contrôle humain explicite.
- **Principe** : Les Créations Nocturnes sont un **espace d’innovation contrôlé** : les agents peuvent proposer et créer (dashboard, métriques, visualisations, tâches), mais les règles de risque et d’exécution ne sont pas modifiées par les agents ; l’opérateur valide les changements sensibles.

### 6.11 Modèle de données — Besoins API

Fichier proposé : `data/dashboard/api_requests.json` (ou tableau en base). Schéma d’un élément :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique de la demande. |
| `agent_id` | string | SENTIMENT_X \| SMART_MONEY \| TECHNICALS \| ORCHESTRATOR \| RISK_JOURNAL \| BOSS. |
| `api_description` | string | Description de l’API ou donnée souhaitée. |
| `reason` | string | Justification (pourquoi l’agent en a besoin). |
| `priority` | string | Optionnel : high \| medium \| low. |
| `timestamp_utc` | string | ISO 8601. |
| `status` | string | REQUESTED \| IN_PROGRESS \| DONE \| REJECTED. |
| `response_note` | string | Optionnel : note de l’opérateur ou du BOSS (ex. « prévu Q2 »). |

Exemple :

```json
{
  "id": "req-001",
  "agent_id": "SMART_MONEY",
  "api_description": "API funding rate Bybit 4h par symbole",
  "reason": "Signaux smart_money partiels sans funding ; low_confidence systématique.",
  "priority": "high",
  "timestamp_utc": "2026-03-01T14:00:00Z",
  "status": "REQUESTED",
  "response_note": null
}
```

### 6.12 Modèle de données — Échanges entre agents (Wire)

Fichier proposé : `data/dashboard/agent_exchanges.json` (ou log append, ou base). Chaque enregistrement = un message ou un échange (demande/réponse) entre deux agents.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique de l’échange. |
| `timestamp_utc` | string | ISO 8601. |
| `from_agent` | string | BOSS \| ORCHESTRATOR \| SENTIMENT_X \| SMART_MONEY \| TECHNICALS \| RISK_JOURNAL. |
| `to_agent` | string | Idem — un ou plusieurs destinataires (ou tableau `to_agents` si multi-destinataire). |
| `type` | string | REQUEST \| RESPONSE \| SHARE_SIGNAL \| BROADCAST. |
| `context` | object | Optionnel : `symbol`, `trade_id`, `window` (ex. morning_brief), `reason`. |
| `content_summary` | string | Résumé lisible du contenu (pour affichage dashboard). |
| `content_ref` | string | Optionnel : chemin vers fichier (signal, idée) ou identifiant de payload. |
| `payload` | object | Optionnel : extrait ou référence au payload (éviter de dupliquer de gros blobs). |

Exemple :

```json
{
  "id": "ex-001",
  "timestamp_utc": "2026-03-01T08:40:00Z",
  "from_agent": "TECHNICALS",
  "to_agent": "SENTIMENT_X",
  "type": "REQUEST",
  "context": { "symbol": "BTCUSDT", "reason": "need_sentiment_for_idea" },
  "content_summary": "Demande sentiment BTC pour idée breakout_retest en cours.",
  "content_ref": "data/ideas/BTCUSDT_20260301_idea_draft.json",
  "payload": null
}
```

**Règle** : tout agent qui initie une demande ou envoie une réponse à un autre agent écrit une entrée dans ce store (ou appelle un outil central qui l’enregistre). Le dashboard affiche le module **Wire** à partir de ce store (fil chronologique, filtres par agent/date/contexte).

### 6.13 Récapitulatif des modules dashboard

| Module | Données / Responsable |
|--------|------------------------|
| **Team** | Config `dashboard/config/team.json` ; lecture des fichiers `agents/<name>/*.md` ; édition par l’opérateur. |
| **TimeLine** | Roadmap + étape courante (config ou fichier) ; Kanban : `data/dashboard/kanban.json` (ou base). |
| **Wire** | `data/dashboard/agent_exchanges.json` ; alimenté par les agents à chaque échange. |
| **Niches** | Fiches scorées par trade idea : `data/dashboard/niches/` ou base ; alimentation depuis TRADE_IDEA + signaux. |
| **OpenClaw Intel** | `data/dashboard/intel/` ; scrapers → classement (indispensable / borderline / rejeté) → propositions. |
| **Cost** | `data/dashboard/costs.json` ou base ; fees, funding, slippage, drawdown, ROI. |
| **Besoins API** | `data/dashboard/api_requests.json` ; alimenté par les agents ; statut mis à jour par opérateur ou BOSS. |
| **Amélioration nocturne** | BOSS (et agents en Créations Nocturnes 1h–7h) : spec/config dashboard, nouvelles métriques, visualisations ; pas de modification des règles risk/stratégie sans validation. |

---

## 7. Outils et connecteurs

### 7.1 Besoin minimal

| Outil | Usage | Priorité V1 | Agent(s) |
|-------|--------|-------------|----------|
| **Market data (OHLCV)** | Chandeliers par symbole/timeframe | Obligatoire | TECHNICALS |
| **News / sentiment (X)** | Flux tweets ou digest | Recommandé (sinon manuel) | SENTIMENT_X |
| **Métriques dérivées** | Funding, OI, liquidations, flows | Optionnel | SMART_MONEY |
| **Storage** | Fichiers JSON + Markdown | Obligatoire | Tous |

### 7.2 Modèles LLM par agent

Chaque agent ayant une tâche spécifique, il est recommandé de leur **attribuer un modèle LLM dédié** (ou un profil) pour optimiser qualité et coût. **ClawRouter** (BlockRun, déjà intégré à OpenClaw) est la base recommandée : un seul provider, wallet USDC (x402), multi-modèles (reasoner, codex, eco, premium, etc.). Le routage actuel est par complexité de tâche ; pour TradeEmpire, on vise une **attribution explicite par agent** (voir document dédié).

- **Référence** : [`AGENTS_LLM_MODELS.md`](./AGENTS_LLM_MODELS.md) — mapping suggéré (ex. BOSS → reasoner, TECHNICALS → codex, SENTIMENT_X → gemini/kimi), options de mise en œuvre (override OpenClaw, config TradeEmpire, ou hint ClawRouter par agent).
- **Implémentation** : soit via la config OpenClaw si un override par agent est supporté, soit via un fichier `trading-empire/config/agents_models.json` lu à l’exécution des tâches.

### 7.3 Connecteur Exchange (OHLCV + optionnel funding)

- **Objectif** : Récupérer les chandeliers (OHLCV) pour les paires et timeframes de la watchlist ; optionnellement funding rate pour SMART_MONEY.
- **Cibles** : Bybit, Binance (ou autre selon config).
- **Données** : symbol, interval (4h, 1d), limit (ex. 100 dernières bougies). Réponse typique : open, high, low, close, volume, timestamp.
- **Auth** : Clé API en lecture seule suffit pour OHLCV ; pas d’ordre envoyé en V1.
- **Rate limits** : Respecter les limites exchange (ex. 1200 req/min Binance) ; pas d’appel en boucle serrée.
- **Fallback** : Si exchange indisponible, TECHNICALS ne produit pas de signaux pour cette fenêtre ; log + optionnel alerte.

### 7.4 Connecteur X (Twitter)

- **Objectif** : Fournir à SENTIMENT_X un flux ou un digest (recherche par mots-clés crypto, comptes listés, etc.).
- **Options** : API officielle (si disponible), outil de scraping contrôlé, ou en V1 digest manuel (fichier déposé dans `data/signals/sentiment/` ou lu par l’agent).
- **Sortie attendue** : Texte + métadonnées (tweet id, url, date) pour citer les sources. Si API absente, SENTIMENT_X peut produire un digest « vide » ou basé sur un fichier manuel.

### 7.5 Connecteur « Derivatives metrics » (optionnel)

- **Objectif** : Funding, open interest, liquidations (par exchange/symbole).
- **Sources possibles** : API exchange (Bybit/Binance), ou services tiers (Glassnode, Coinglass, etc.).
- **Utilisation** : SMART_MONEY produit des signaux (ex. « funding élevé », « OI spike ») avec source et, si donnée partielle, low_confidence.

### 7.6 Storage (fichiers)

- Tous les agents écrivent dans `data/` selon les chemins définis (§4 et §10). Pas de base de données obligatoire en V1 ; les fichiers JSON et Markdown constituent la trace et le partage inter-agents. Retention : à définir (ex. conserver 30 jours de signaux, 1 an de journal).

---

## 8. Garde-fous et conformité

### 8.1 Max idées par jour

- **Règle** : Pas plus de N idées PROPOSED par jour (ex. N = 5). Configurable dans project.md ou risk_rules.
- **Application** : ORCHESTRATOR compte les idées déjà produites pour la date courante et s’arrête quand la limite est atteinte.
- **Action** : Ne pas générer de nouvelles idées ; log + optionnel message dans le brief « limite idées atteinte ».

### 8.2 No-trade conditions

- **Règles** : Pas de trade (donc pas d’idée approuvée pour exécution) si : funding extrême (ex. > 0.02), volatilité trop haute (règle objective à définir, ex. ATR > X % du prix), news majeure (si filtre activé). Définies dans risk_rules ou strategy_rules.
- **Application** : RISK_JOURNAL rejette ou NEED_MORE_INFO si une de ces conditions est présente ; ORCHESTRATOR peut aussi ne pas proposer d’idée si les signaux indiquent une de ces conditions.

### 8.3 Interdiction d’optimiser la stratégie par les agents

- **Règle** : Les agents ne peuvent pas modifier les fichiers dans `rules/` (risk_rules.md, strategy_rules.md, execution_policy.md). Ils ne peuvent que les lire.
- **Modification des règles** : Uniquement par un humain, via processus de review (ticket, validation, puis édition des fichiers).

### 8.4 Traçabilité

- **Règle** : Chaque idée cite ses sources (sources[]) et les conditions d’invalidation (invalid). Chaque décision est enregistrée dans `data/decisions/` avec raison si rejet.
- **Application** : Les fichiers dans `data/` servent d’audit ; pas de suppression automatique des idées ou décisions (retention selon politique définie).

### 8.5 Kill switch

- **Règle** : Si un agent dérive (comportement anormal, erreurs répétées, contenu inapproprié), désactivation de ses tâches cron sans modifier le code des autres agents.
- **Application** : Désactiver le cron de l’agent concerné (ex. dans la config des tâches planifiées OpenClaw). Optionnel : flag ou fichier `agents/<name>/disabled` lu par le scheduler pour ne pas lancer l’agent.

---

## 9. Processus d’implémentation

### 9.1 Étape A — Créer le workspace

- Créer le dossier `trading-empire/` (ou équivalent dans le workspace OpenClaw).
- Créer l’arborescence complète : `rules/`, `memory/daily/`, `memory/weekly/`, `data/signals/...`, `data/ideas/`, `data/decisions/`, `data/journal/`, `data/dashboard/` (avec `api_requests.json` et `agent_exchanges.json` pour les sections Besoins API et Échanges entre agents), `dashboard/config/`, `dashboard/spec/`, `agents/boss/`, `agents/orchestrator/`, etc.
- Renseigner `project.md` (objectifs, univers, cadence, sorties, règle d’or) et la **watchlist** (symboles).
- Renseigner `rules/risk_rules.md`, `rules/strategy_rules.md`, `rules/execution_policy.md` avec des valeurs par défaut ou cibles.
- Créer `README.md` du projet avec lien vers ce PRD.

**Checkpoint** : Structure visible, fichiers rules et project.md présents et cohérents.

### 9.2 Étape B — Déclarer les agents

- Pour chaque agent (**boss**, orchestrator, sentiment_x, smart_money, technicals, risk_journal), créer et remplir :
  - `identity.md` (ton, rôle, interdits — ex. « jamais d’ordre », « toujours citer source »).
  - `agent.md` (mission, do/don’t, outputs comme dans §3).
  - `tasks.md` (tâches déclenchées par cron ou manuellement, entrées/sorties).
  - `tools.md` (liste des outils utilisés : lecture fichiers, appel API, écriture dans data/).
  - `memory.md` (utilisation de memory/daily, memory/weekly si applicable).
- S’assurer que les interdits sont explicites (pas de validation de trade pour Orchestrator, pas de certitude pour Technicals, etc.).

**Checkpoint** : Chaque agent a ses 5 fichiers et OpenClaw peut les charger.

### 9.3 Étape C — Brancher la notification sur ORCHESTRATOR

- Configurer un seul canal de notification (ex. Telegram) branché sur l’ORCHESTRATOR.
- Contenu envoyé : daily brief, idées à valider (résumé), alertes risque.
- Vérifier qu’aucun autre agent n’envoie de notification directement (pas de spam multi-bots).

**Checkpoint** : Un message de test envoyé par l’orchestrateur ; aucun autre agent ne pousse de notif.

### 9.4 Étape D — Production de fichiers dans data/

- Implémenter ou configurer les agents pour qu’ils écrivent dans les bons chemins (voir §4 et §11).
- Vérifier les noms de fichiers (timestamp, symbol, etc.) et le format JSON (TRADE_IDEA, SIGNAL).
- Mettre en place l’enregistrement des **échanges entre agents** : lorsqu’un agent envoie une demande ou une réponse à un autre, écrire une entrée dans `data/dashboard/agent_exchanges.json` (voir §6.6) pour alimenter la section « Échanges entre agents » du dashboard.
- Tester : lancer manuellement chaque agent et vérifier la présence et la validité des fichiers produits (signals, ideas, decisions, journal, agent_exchanges).

**Checkpoint** : Chaque type de sortie (signals, ideas, decisions, journal, agent_exchanges) est produit au bon endroit avec le bon schéma.

### 9.5 Étape E — Mettre en place le cron

- Créer les tâches planifiées : TECHNICALS (ex. 08:15), SMART_MONEY (08:25), SENTIMENT_X (08:35), ORCHESTRATOR (08:45), RISK_JOURNAL (08:55) ; puis evening RISK_JOURNAL + optionnel ORCHESTRATOR (20:30) ; et **tâche nocturne BOSS** (ex. 01:00) pour amélioration du dashboard et synthèse des besoins API.
- Définir les dépendances (orchestrator après les 3 capteurs, risk après orchestrator).
- Configurer retry et gestion d’échec (§5.4).
- Tester une séquence complète sur une fenêtre.

**Checkpoint** : Une fenêtre complète s’exécute de bout en bout et les fichiers sont à jour.

### 9.6 Étape F — Phase paper (V1)

- Pendant au moins 2 semaines : laisser les agents produire des idées et des décisions sans exécution.
- Noter : quelles idées auraient été gagnantes/perdantes, lesquelles sont nulles ou bruit, et pourquoi.
- Ajuster en priorité les **règles** (risk_rules, strategy_rules, watchlist, scoring) plutôt que les prompts à l’infini.
- Après 7 jours : revue documentée (watchlist, scoring, risk_rules, format des idées) comme indiqué dans le PRD.

**Checkpoint** : Rapport court de phase paper (réglages effectués, décision de passer ou non en V2).

---

## 10. Critères d’acceptation et scénarios de test

### 10.1 Critères d’acceptation (V1)

- [ ] Workspace `trading-empire/` créé avec structure complète (rules, memory, data, agents, dashboard).
- [ ] Les 6 agents (BOSS + ORCHESTRATOR, SENTIMENT_X, SMART_MONEY, TECHNICALS, RISK_JOURNAL) ont chacun identity.md, agent.md, tasks.md, tools.md, memory.md cohérents avec ce PRD ; tous se réfèrent au BOSS.
- [ ] Au moins un connecteur market data (OHLCV) opérationnel pour TECHNICALS.
- [ ] Les agents écrivent des fichiers dans `data/signals/**`, `data/ideas/**`, `data/decisions/**`, `data/journal/**` au format défini.
- [ ] ORCHESTRATOR produit un daily brief et consolide au plus 3–7 idées/jour (ou moins si limite à 5) ; RISK_JOURNAL produit des décisions APPROVE/REJECT/NEED_MORE_INFO et le journal quotidien.
- [ ] Cadence (cron) configurée : au moins 2 fenêtres/jour (ex. morning + evening).
- [ ] Un seul point de notification (ex. Telegram) branché sur le BOSS / ORCHESTRATOR.
- [ ] Aucune exécution automatique des ordres en V1.
- [ ] Dashboard avec modules **Team** (agents, fichiers, API), **TimeLine** (roadmap + Kanban), **Wire** (échanges), **Niches** (fiches scorées par trade idea), **OpenClaw Intel** (scrape, classement, propositions), **Cost** (fees, funding, drawdown, ROI) et section **Besoins API** ; Créations Nocturnes (1h–7h) encadrées (amélioration dashboard autorisée ; pas de modification règles sans validation).
- [ ] Après 7 jours de run, revue des watchlist, scoring et risk_rules documentée.

### 10.2 Scénarios de test

| Scénario | Étapes | Résultat attendu |
|----------|--------|------------------|
| **Signaux techniques** | Lancer TECHNICALS avec OHLCV dispo pour 1 symbole + 1 timeframe. | Fichier créé dans `data/signals/technicals/` avec trend, levels, confidence. |
| **Idée complète** | ORCHESTRATOR reçoit au moins 1 signal de chaque type (technicals, sentiment, smart_money) et produit une idée. | Fichier TRADE_IDEA dans `data/ideas/` avec entry, invalid, targets, risk, sources, status PROPOSED. |
| **Rejet par risque** | RISK_JOURNAL reçoit une idée avec max_loss_usd > max autorisé dans risk_rules. | Décision REJECTED dans `data/decisions/` avec reason. |
| **Journal** | Après une fenêtre avec au moins 1 idée proposée et 1 décision. | `data/journal/{date}.md` contient résumé des idées et décisions avec raisons. |
| **Limite idées** | ORCHESTRATOR a déjà produit 5 idées pour la date du jour. | Aucune nouvelle idée ; log ou brief indique limite atteinte. |
| **Notification** | Après run complet morning. | Un seul message (brief) reçu sur le canal (Telegram), émanant de l’orchestrateur. |
| **Besoins API** | Un agent (ex. SMART_MONEY) écrit une entrée dans `data/dashboard/api_requests.json`. | La section Besoins API du dashboard affiche la demande ; le BOSS peut la lire lors de sa tâche nocturne. |
| **Échanges entre agents** | Un agent (ex. TECHNICALS) envoie une demande à un autre (ex. SENTIMENT_X) ; l’échange est enregistré dans `data/dashboard/agent_exchanges.json`. | La section « Échanges entre agents » du dashboard affiche l’échange (from, to, type, contexte, résumé). |
| **BOSS dashboard** | Exécution de la tâche nocturne du BOSS (après une journée avec signaux + besoins API). | Le BOSS produit une spec ou config d’amélioration du dashboard dans `dashboard/spec/` ou `dashboard/config/`. |
| **Module Niches** | Une trade idea est produite ; un agent ou l’orchestrateur génère la fiche Niches (macro, trend HTF, structure LTF, volume, funding, sentiment, OI, invalidation, R:R, score). | Fichier ou entrée dans `data/dashboard/niches/` avec score global et tous les champs. |
| **Créations Nocturnes** | Pendant la fenêtre 1h–7h, un agent propose une amélioration dashboard (nouvelle métrique ou visualisation). | Proposition écrite dans `dashboard/spec/` ou Kanban ; aucune modification de risk_rules ou strategy_rules. |

---

## 11. Livrables et structure des fichiers

### 11.1 Arborescence complète

```
trading-empire/
  README.md
  project.md
  rules/
    risk_rules.md
    strategy_rules.md
    execution_policy.md
  memory/
    daily/
    weekly/
  data/
    signals/
      sentiment/
      smart_money/
      technicals/
    ideas/
    decisions/
    journal/
    dashboard/
      api_requests.json
      agent_exchanges.json
      kanban.json
      costs.json
      intel/
      niches/
  dashboard/
    config/
      team.json
    spec/
  agents/
    boss/
      identity.md, agent.md, tasks.md, tools.md, memory.md
    orchestrator/
      identity.md, agent.md, tasks.md, tools.md, memory.md
    sentiment_x/
      identity.md, agent.md, tasks.md, tools.md, memory.md
    smart_money/
      identity.md, agent.md, tasks.md, tools.md, memory.md
    technicals/
      identity.md, agent.md, tasks.md, tools.md, memory.md
    risk_journal/
      identity.md, agent.md, tasks.md, tools.md, memory.md
```

### 11.2 Rôle des dossiers

| Dossier | Rôle |
|---------|------|
| `rules/` | Règles lues par les agents ; modifiées uniquement par humain. |
| `memory/daily/`, `memory/weekly/` | Persistance de contexte par agent (selon memory.md). |
| `data/signals/` | Signaux bruts ou agrégés (sentiment, smart_money, technicals). |
| `data/ideas/` | Idées de trade (TRADE_IDEA, status PROPOSED puis mis à jour après décision). |
| `data/decisions/` | Décisions RISK_JOURNAL (APPROVED, REJECTED, NEED_MORE_INFO). |
| `data/journal/` | Brief et journal quotidien (Markdown). |
| `data/dashboard/` | Données du dashboard : api_requests.json, agent_exchanges.json (Wire), kanban.json (TimeLine), costs.json (Cost), intel/, niches/ (fiches scorées). |
| `dashboard/config/`, `dashboard/spec/` | Config (ex. team.json) et specs du dashboard ; le BOSS et les Créations Nocturnes y écrivent les améliorations. |
| `agents/<name>/` | Définition du rôle, tâches, outils et mémoire de chaque agent (dont `boss/`). |

### 11.3 Conventions de nommage

- **Signaux** : `{symbol}_{tf}_{timestamp}.json` (technicals), `{date}_x_digest.json` ou `{symbol}_{timestamp}.json` (sentiment), `{symbol}_{timestamp}.json` (smart_money). Timestamp au format YYYYMMDDHHmmss ou ISO.
- **Idées** : `{trade_id}.json` ou `{symbol}_{timestamp}_idea.json` (à fixer selon implémentation).
- **Décisions** : `{trade_id}_APPROVED.json` / `_REJECTED.json` / `_NEED_MORE_INFO.json`.
- **Journal** : `{date}.md` (journal), `{date}_brief.md` (brief). Date YYYY-MM-DD.

### 11.4 Livrables documentaires

| Livrable | Fichier / Contenu |
|----------|--------------------|
| PRD | `workspace/TradeEmpire/PRD.md` (ce document) |
| Plan source | `workspace/TradeEmpire/idea.txt` |
| Projet | `trading-empire/project.md` |
| Règles | `trading-empire/rules/risk_rules.md`, `strategy_rules.md`, `execution_policy.md` |
| Agents | Fichiers dans `trading-empire/agents/<name>/` (dont `boss/`) |
| Dashboard | Config : `dashboard/config/team.json`, `dashboard/spec/` ; données : `data/dashboard/api_requests.json`, `agent_exchanges.json`, `kanban.json`, `costs.json`, `intel/`, `niches/` |
| Cron | Config des tâches planifiées OpenClaw (dépendances, horaires, retries ; incl. tâche nocturne BOSS) |

---

## 12. Risques et mitigations

| Risque | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Hallucinations / données inventées | Moyenne | Élevé | Outils fiables (OHLCV, APIs) ; règle low_confidence ; « toujours citer source » dans identity ; validation des champs par RISK_JOURNAL. |
| Sur-trading | Moyenne | Élevé | Limiter à 2–3 fenêtres/jour et max 5 idées/jour ; pas d’exécution auto en V1. |
| Dérive d’un agent | Faible | Moyen | Kill switch (désactivation cron) ; audit via journal et sources ; revue des sorties en phase paper. |
| Indisponibilité exchange / API | Moyenne | Moyen | Fallback : pas de signaux pour la fenêtre ; retry avec backoff ; log + alerte optionnelle. |
| Exécution non voulue en V2 | Faible si garde-fous | Très élevé | V2 conditionnée à stratégie figée, risque strict, audit complet, kill switch ; EXECUTOR très bridé (ordres uniquement selon plan validé). |
| Règles modifiées par erreur | Faible | Élevé | Fichiers rules en lecture seule pour les agents ; modification uniquement par processus humain (review). |

---

## 13. Résumé exécutif

**Trading Empire V1** est un système multi-agents OpenClaw qui : (1) un **agent BOSS** est le chef de tous les autres ; (2) **tous les agents se connaissent et peuvent échanger** pour le résultat le plus pertinent ; (3) collecte des signaux (techniques, sentiment X, smart money) ; (4) consolide des idées TRADE_IDEA.json ; (5) validation par RISK_JOURNAL ; (6) journal et brief ; (7) pas d’exécution en V1. **Dashboard** : modules **Team** (agents, nom, photo, skills, fichiers agent éditables, APIs), **TimeLine** (roadmap vers trading automatisé + Kanban amélioration continue), **Wire** (échanges entre agents), **Niches** (fiche structurée scorée par trade idea : macro, trend HTF, structure LTF, volume, funding, sentiment, OI, invalidation, R:R, score global), **OpenClaw Intel** (scrape X, YouTube, tendances, outils, updates → classer, filtrer, proposer implémentation ; indispensable / borderline / rejeté), **Cost** (coûts fixes, API, requêtes, fees, funding, slippage, drawdown, ROI), **Besoins API**. **Créations Nocturnes (1h–7h)** : agents peuvent proposer améliorations dashboard, métriques, visualisations, tâches Kanban ; pas d’exécution critique ni modification des règles risk/stratégie/position sans validation. La valeur vient de la structure, traçabilité, collaboration et garde-fous. Ce PRD détaille les sections pour l’implémentation dans OpenClaw.

---

## 14. Annexes et complétude du PRD

### 14.1 Documents liés (références)

| Document | Rôle |
|----------|------|
| [`idea.txt`](./idea.txt) | Plan source (transposition POD Empire → Trading Empire). |
| [`AGENTS_LLM_MODELS.md`](./AGENTS_LLM_MODELS.md) | Attribution de modèles LLM par agent ; ClawRouter ; options de mise en œuvre. |
| [`DASHBOARD_DESIGN.md`](./DASHBOARD_DESIGN.md) | Design visuel et structure attendus du dashboard (layout, sidebar, zone centrale). |
| [`themeDash.webp`](./themeDash.webp) | Maquette visuelle de référence du dashboard (à reproduire). |
| [`ETAPE_SUIVANTE.md`](./ETAPE_SUIVANTE.md) | Étape suivante après le PRD : design technique, backlog priorisé, MVP (pour un développement efficace et sans bavure). |

### 14.2 Référence au design du dashboard

Le rendu visuel du dashboard (thème sombre, accents orange, sidebar, zone centrale) et le mapping des entrées de navigation vers les modules (Team, TimeLine, Wire, etc.) sont décrits dans **`DASHBOARD_DESIGN.md`**. La maquette à prendre comme modèle est **`themeDash.webp`**.

### 14.3 Éléments optionnels ou à compléter

Le PRD couvre vision, périmètre, agents, données, cadence, dashboard, outils, garde-fous, implémentation, critères d’acceptation, livrables et risques. Les points suivants peuvent être ajoutés ou précisés selon le besoin :

| Élément | Description | Priorité |
|--------|-------------|----------|
| **Glossaire** | Définitions courtes (HTF, LTF, R:R, funding, OI, TRADE_IDEA, PROPOSED, etc.) pour les lecteurs. | Optionnel |
| **Prérequis / environnement** | OpenClaw (version ou compatibilité), ClawRouter actif, wallet USDC si modèles payants, Node, extensions ; où tourne le système (local, serveur, Docker). | Recommandé avant implémentation |
| **Sécurité et secrets** | Stockage des clés API (exchange, X), clé wallet ClawRouter ; pas de log de données sensibles ; qui a accès au dashboard. | Recommandé |
| **Paramètres par défaut (risk_rules)** | Valeurs suggérées pour X, Y, N, M, L et R:R minimum (ex. 50 USD, 150 USD, 5, 3, 2, 1.2) — actuellement « à définir ». | Optionnel (défaut dans rules/) |
| **Phasage MVP dashboard** | Ordre de livraison des modules (ex. Phase 1 : Team + Wire + Brief ; Phase 2 : TimeLine/Kanban, Niches ; Phase 3 : Intel, Cost) si tout ne peut pas être livré d’un coup. | Optionnel |
| **Calcul du score Niches** | Comment le score global de la fiche Niches est calculé (pondération des critères, formule) — peut rester « à définir » ou faire l’objet d’un doc dédié. | Optionnel |
| **Format du brief (notification)** | Contenu exact du message Telegram (résumé, liens, longueur max, fréquence) pour éviter le spam. | Optionnel (déjà cadence) |

### 14.4 Synthèse complétude

Le PRD est **complet** pour la spécification fonctionnelle et technique de la V1 : objectifs, acteurs, flux, données, dashboard, garde-fous, étapes d’implémentation et critères d’acceptation. Les annexes ci-dessus permettent de rattacher les documents de référence (design, modèles LLM) et d’identifier les compléments utiles (prérequis, sécurité, paramètres par défaut) sans alourdir le corps du document.

---
*Document préparé par l’assistant OpenClaw pour le projet Trading Empire à partir de `idea.txt`. Version 1.4 — Dashboard : modules Team, TimeLine, Wire, Niches, OpenClaw Intel, Cost, Besoins API ; Créations Nocturnes (1h–7h) autonomie encadrée.*
