# Spécification détaillée — Phase 2 (Agents et flux V1)

Ce document détaille au maximum les tâches 9 à 12 du backlog : SMART_MONEY, SENTIMENT_X, ORCHESTRATOR, RISK_JOURNAL, puis enchaînement et dashboard.

---

## 1. SMART_MONEY (tâche 9)

### 1.1 Objectif

Produire un fichier signal par symbole (watchlist) dans `data/signals/smart_money/` avec funding rate et signaux dérivés (pas d’API clé requise pour Binance Futures).

### 1.2 Source de données

- **Binance USDT-M Futures** (public) :
  - `GET https://fapi.binance.com/fapi/v1/premiumIndex?symbol=SYMBOL` → `lastFundingRate`, `markPrice`, `nextFundingTime`.
  - Optionnel : `GET https://fapi.binance.com/fapi/v1/fundingRate?symbol=SYMBOL&limit=5` pour historique.
- Watchlist : lue depuis `project.md` ou liste fixe MVP : `['BTCUSDT']` (étendre à ETHUSDT si souhaité).

### 1.3 Format de sortie (PRD §4.2)

Fichier : `data/signals/smart_money/{symbol}_{timestamp}.json` avec `timestamp` = `YYYYMMDDHHmmss`.

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|--------------|
| `timestamp_utc` | string (ISO 8601) | Oui | Horodatage du scan. |
| `symbol` | string | Oui | Ex. BTCUSDT. |
| `signals` | string[] | Oui | Ex. "funding positive", "funding negative", "funding neutral". |
| `metrics` | object | Oui | `{ "funding": number, "mark_price"?: number, "next_funding_time"?: number }`. |
| `sources` | array | Oui | `[{ "type": "exchange", "ref": "binance_futures_premiumIndex" }]`. |
| `low_confidence` | boolean | Oui | true si donnée partielle ou API indisponible. |

Règle de dérivation des `signals` (exemple) :
- `funding > 0.0001` → "funding positive" (longs paient shorts).
- `funding < -0.0001` → "funding negative" (shorts paient longs).
- Sinon → "funding neutral".

### 1.4 Scripts

- **`scripts/fetch-funding.js`** : appelle l’API Binance pour un symbole, retourne JSON sur stdout (funding rate, mark price).
- **`scripts/smart-money-scan.js`** : pour chaque symbole de la watchlist, appelle fetch-funding (ou équivalent), construit l’objet signal, écrit `data/signals/smart_money/{symbol}_{timestamp}.json`. Crée le répertoire si besoin.

### 1.5 Gestion d’erreur

- Si l’API Binance échoue pour un symbole : écrire quand même un fichier avec `low_confidence: true`, `signals: []`, `metrics: {}`, et une source indiquant l’échec.
- Ne pas faire échouer tout le scan si un symbole échoue.

---

## 2. SENTIMENT_X (tâche 10)

### 2.1 Objectif

Produire un digest sentiment (sans API X payante) pour alimenter l’orchestrateur. En V1 : **stub** (fichier généré avec valeurs par défaut / manuelles).

### 2.2 Format de sortie (PRD §4.2)

Deux options :
- **Digest global** : `data/signals/sentiment/{date}_x_digest.json` (date = YYYY-MM-DD).
- **Par symbole** : `data/signals/sentiment/{symbol}_{timestamp}.json`.

Pour le MVP, un seul fichier **digest** suffit : `{date}_x_digest.json`.

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|--------------|
| `timestamp_utc` | string (ISO 8601) | Oui | Horodatage. |
| `date` | string | Oui | YYYY-MM-DD. |
| `narratives` | string[] | Oui | Ex. ["ETF inflows", "macro cautious"]. Stub : ["stub_narrative"]. |
| `sentiment_by_symbol` | object | Oui | `{ "BTCUSDT": "neutral" \| "bullish" \| "bearish", ... }`. Stub : BTCUSDT → "neutral". |
| `risk_signals` | string[] | Oui | Ex. ["rug_risk", "fake_news"]. Stub : []. |
| `sources` | array | Oui | Stub : `[{ "type": "stub", "ref": "manual_or_cron" }]`. |
| `low_confidence` | boolean | Oui | true pour stub (pas de vraie source X). |

### 2.3 Script

- **`scripts/sentiment-scan.js`** : génère `data/signals/sentiment/{date}_x_digest.json` avec les champs ci-dessus et des valeurs stub. Lit la watchlist pour remplir `sentiment_by_symbol` (tous "neutral" en stub).

### 2.4 Évolution V1+

- Remplacer le stub par un flux X (API ou scraping) et remplir `narratives`, `sentiment_by_symbol`, `risk_signals` et `sources` avec de vraies données.

---

## 3. ORCHESTRATOR (tâche 11)

### 3.1 Objectif

Lire les signaux des trois répertoires (technicals, smart_money, sentiment), les agréger, et produire **une ou plusieurs** idées TRADE_IDEA dans `data/ideas/` avec `status: "PROPOSED"`.

### 3.2 Entrées

- **Technicals** : tous les fichiers `data/signals/technicals/*.json` (prendre les plus récents par symbole/timeframe si plusieurs).
- **Smart money** : tous les fichiers `data/signals/smart_money/*.json` (plus récent par symbole).
- **Sentiment** : fichier `data/signals/sentiment/{date}_x_digest.json` du jour (ou dernier disponible).
- **Règles** : `rules/strategy_rules.md` (setups autorisés), `rules/risk_rules.md` (max loss, R:R min).

### 3.3 Logique d’agrégation (règles métier)

1. Pour chaque **symbole** présent dans les technicals :
   - Récupérer le dernier signal technical (tri par `timestamp_utc` décroissant).
   - Récupérer le dernier signal smart_money pour ce symbole (idem).
   - Récupérer le sentiment pour ce symbole depuis le digest (ou "neutral" si absent).
2. **Filtrage** :
   - Ne produire une idée que si au moins un signal technical contient des `setup_candidates` non vides OU une tendance + des levels exploitables (règle simplifiée MVP : si trend !== "range" et levels présents).
   - Aligner `setup_name` sur `strategy_rules.md` (breakout_retest, range).
3. **Construction TRADE_IDEA** :
   - `direction` : déduit de `trend` (up → LONG, down → SHORT).
   - `entry` : dérivé des levels (ex. dernier support pour LONG, dernier resistance pour SHORT) ou prix actuel (depuis technicals ou smart_money mark_price).
   - `invalid` : niveau sous le support (LONG) ou au-dessus de la résistance (SHORT).
   - `targets` : au moins 2 targets avec R:R ≥ 1.2 (lire depuis risk_rules).
   - `confidence` : combinaison simple (ex. moyenne pondérée technique + sentiment + smart_money) entre 0 et 1.
   - `evidence` : tableaux de strings résumant technicals (trend, levels), sentiment (narratives, sentiment_by_symbol), smart_money (signals).
   - `risk` : `max_loss_usd` depuis risk_rules (50), `position_size_usd` et `leverage` cohérents.
   - `trade_id` : généré unique (ex. `idea_{symbol}_{timestamp_14}`).
   - `status` : toujours "PROPOSED".

### 3.4 Format de sortie (PRD §4.1)

Fichier : `data/ideas/{trade_id}.json` (ou `{symbol}_{date}_idea.json`). Contenu = TRADE_IDEA complet.

Champs obligatoires : `timestamp_utc`, `symbol`, `timeframe`, `direction`, `setup_name`, `entry`, `invalid`, `targets`, `confidence`, `evidence`, `risk`, `sources`, `status`, `trade_id`.

### 3.5 Script

- **`scripts/orchestrator-scan.js`** :
  - Lire tous les JSON dans `data/signals/technicals/`, `data/signals/smart_money/`, `data/signals/sentiment/`.
  - Déduire la date du jour (UTC ou Europe/Paris) pour le digest sentiment.
  - Appliquer la logique d’agrégation et de filtrage.
  - Produire entre 0 et 7 idées (max 7 comme dans le PRD).
  - Écrire chaque idée dans `data/ideas/{trade_id}.json`.

### 3.6 Gestion des cas limites

- Aucun signal technical → ne pas écrire d’idée.
- Pas de smart_money pour un symbole → utiliser evidence smart_money vide, pas bloquant.
- Pas de digest sentiment → utiliser sentiment "neutral" pour tous les symboles.

---

## 4. RISK_JOURNAL (tâche 12)

### 4.1 Objectif

Lire toutes les idées dans `data/ideas/` avec `status === "PROPOSED"`, vérifier la conformité aux `risk_rules.md` et la cohérence entry/invalid/targets, puis écrire une décision par idée et un journal du jour.

### 4.2 Entrées

- Fichiers `data/ideas/*.json` dont `status === "PROPOSED"`.
- `rules/risk_rules.md` : parsing des valeurs (max perte par trade 50, max par jour 150, max trades/jour 5, max positions 3, leverage max 2, R:R minimum 1.2).

### 4.3 Règles de décision

- **APPROVED** : idée conforme (max_loss_usd ≤ 50, leverage ≤ 2, targets avec rr ≥ 1.2, entry/invalid cohérents, invalidation claire).
- **REJECTED** : violation d’une règle (ex. max_loss_usd > 50, leverage > 2, R:R < 1.2, entry/invalid incohérents pour la direction).
- **NEED_MORE_INFO** : donnée manquante ou ambiguë (ex. entry ou invalid absent).

Cohérence entry/invalid :
- LONG : entry.price doit être > invalid.price (ou invalid décrit un niveau à casser en dessous).
- SHORT : entry.price doit être < invalid.price.

### 4.4 Sorties

- **Décision** : pour chaque idée PROPOSED, écrire `data/decisions/{trade_id}_{status}.json` avec :
  - `trade_id`, `status` (APPROVED | REJECTED | NEED_MORE_INFO), `timestamp_utc`, `reason` (obligatoire si REJECTED ou NEED_MORE_INFO), `idea_ref` (chemin ou trade_id de l’idée).
- **Journal** : écrire `data/journal/{date}.md` (date = YYYY-MM-DD) avec :
  - Titre : Journal du jour {date}.
  - Liste des idées proposées (trade_id, symbol, direction, setup_name).
  - Pour chaque idée : décision (APPROVED/REJECTED/NEED_MORE_INFO) et raison si rejet ou need_more_info.
  - Optionnel : court post-mortem (une phrase si aucune idée, ou résumé).

### 4.5 Mise à jour des idées

- Après décision, mettre à jour le fichier idée dans `data/ideas/` : remplacer `status` par APPROVED ou REJECTED ou NEED_MORE_INFO (optionnel mais utile pour cohérence).

### 4.6 Script

- **`scripts/risk-journal-scan.js`** :
  - Lister `data/ideas/*.json`, filtrer `status === "PROPOSED"`.
  - Lire et parser `rules/risk_rules.md` (regex ou parsing simple pour extraire 50, 150, 5, 3, 2, 1.2).
  - Pour chaque idée : vérifier les règles, décider APPROVED/REJECTED/NEED_MORE_INFO, écrire `data/decisions/{trade_id}_{status}.json`.
  - Écrire `data/journal/{date}.md`.
  - Optionnel : mettre à jour le champ `status` dans chaque fichier idée.

---

## 5. Enchaînement (séquence matin)

### 5.1 Ordre d’exécution

1. TECHNICALS (déjà en place) : `node scripts/technicals-scan.js`
2. SMART_MONEY : `node scripts/smart-money-scan.js`
3. SENTIMENT_X : `node scripts/sentiment-scan.js`
4. ORCHESTRATOR : `node scripts/orchestrator-scan.js`
5. RISK_JOURNAL : `node scripts/risk-journal-scan.js`

### 5.2 Script unique « run-morning »

- **`scripts/run-morning.js`** : exécute dans l’ordre les 5 scripts (via `child_process.execSync` ou spawn), depuis la racine `trading-empire/`. En cas d’erreur sur un script, loguer et continuer ou sortir en erreur (configurable). Utile pour un seul cron « TradeEmpire morning » qui lance run-morning.

### 5.3 Crons OpenClaw

- Conserver ou ajouter les jobs dans `cron/jobs.json` :
  - 08:15 TECHNICALS (existant).
  - 08:25 SMART_MONEY (nouveau).
  - 08:35 SENTIMENT_X (nouveau).
  - 08:45 ORCHESTRATOR (nouveau).
  - 08:55 RISK_JOURNAL (nouveau).
- Ou un seul job 08:15 qui lance `run-morning.js` (plus simple).

---

## 6. Dashboard (extensions Phase 2)

### 6.1 Nouvelles routes API (dashboard-server.js)

- `GET /api/signals/smart_money` → liste des signaux smart_money (comme technicals).
- `GET /api/signals/sentiment` → dernier digest ou liste des fichiers sentiment.
- `GET /api/ideas` → liste des TRADE_IDEA (data/ideas/*.json).
- `GET /api/decisions` → liste des décisions (data/decisions/*.json).
- `GET /api/journal/:date` → contenu de data/journal/{date}.md (texte brut ou HTML).

### 6.2 Page dashboard

- Onglets ou sections : Signaux techniques (existant), Signaux smart money, Sentiment, Idées (PROPOSED/APPROVED/REJECTED), Décisions, Journal du jour.
- Pas obligatoire pour la livraison Phase 2 « flux débogué », mais recommandé pour visibilité.

---

## 7. Fichiers agents (tasks, tools)

- **agents/smart_money/tasks.md** : « Pour chaque symbole watchlist, appeler fetch-funding puis écrire data/signals/smart_money/{symbol}_{timestamp}.json. »
- **agents/smart_money/tools.md** : « scripts/fetch-funding.js, scripts/smart-money-scan.js. »
- **agents/sentiment_x/tasks.md** : « Produire le digest sentiment (stub) data/signals/sentiment/{date}_x_digest.json. »
- **agents/sentiment_x/tools.md** : « scripts/sentiment-scan.js. »
- **agents/orchestrator/tasks.md** : « Lire signaux technicals, smart_money, sentiment ; produire jusqu’à 7 idées TRADE_IDEA dans data/ideas/. »
- **agents/orchestrator/tools.md** : « scripts/orchestrator-scan.js. »
- **agents/risk_journal/tasks.md** : « Lire idées PROPOSED, appliquer risk_rules, écrire data/decisions/ et data/journal/{date}.md. »
- **agents/risk_journal/tools.md** : « scripts/risk-journal-scan.js. »

---

## 8. Critères de succès Phase 2

- [ ] Exécution de `run-morning.js` (ou les 5 scripts dans l’ordre) sans erreur.
- [ ] Présence de fichiers dans `data/signals/smart_money/` et `data/signals/sentiment/`.
- [ ] Au moins une idée dans `data/ideas/` (si les signaux technicals le permettent) avec status PROPOSED.
- [ ] Pour chaque idée PROPOSED, une décision dans `data/decisions/{trade_id}_{status}.json`.
- [ ] Fichier `data/journal/{date}.md` avec résumé des idées et décisions.
- [x] Règles risk respectées (max_loss 50, leverage 2, R:R ≥ 1.2) reflétées dans les rejets si une idée les viole.

---

## 9. Implémentation (réalisée)

- **Scripts** : `scripts/fetch-funding.js`, `smart-money-scan.js`, `sentiment-scan.js`, `orchestrator-scan.js`, `risk-journal-scan.js`, `run-morning.js`.
- **Cron** : job `tradeempire-morning` (08:15 Europe/Paris) dans `cron/jobs.json` ; exécute `run-morning.js` via agentTurn.
- **Dashboard** : routes `/api/signals/smart_money`, `/api/signals/sentiment`, `/api/ideas`, `/api/decisions`, `/api/journal/:date` ; page avec onglets Smart money, Sentiment, Idées, Décisions, Journal.
- **Agents** : tasks.md et tools.md remplis pour smart_money, sentiment_x, orchestrator, risk_journal.
