# Design technique — TradeEmpire (MVP → V1)

**Objectif** : Fixer la stack, les flux et les interfaces pour une implémentation cohérente. Ce document couvre d’abord le MVP (workspace + TECHNICALS + OHLCV → 1 signal), puis les extensions V1.

---

## 1. Stack et prérequis

| Composant | Choix MVP / V1 |
|-----------|-----------------|
| **OpenClaw** | Environnement d’exécution (workspace `~/.openclaw/workspace`, cron via `openclaw cron run <jobId>`). Pas de version minimale imposée ; utiliser le gateway pour les crons. |
| **ClawRouter (BlockRun)** | Provider LLM (proxy 8402, wallet USDC si modèles payants). Utilisé par les agents quand ils ont besoin d’un LLM. Pour le MVP TECHNICALS « pur données », un script sans LLM suffit. |
| **Langage des outils** | **Node.js** pour les scripts (fetch OHLCV, calcul technique, écriture JSON) — cohérent avec les autres scripts du workspace (dto-api.js, openclaw-watchguard.js). Python possible en alternatif pour libs pandas/TA. |
| **Dashboard** | **MVP** : serveur Node minimal (`scripts/dashboard-server.js`) + page HTML (thème sombre, accents orange, sidebar) + API `GET /api/signals/technicals` qui lit `data/signals/technicals/*.json`. Port par défaut 3579. En V1 : modules avancés (Team, TimeLine, Wire, Niches, Intel, Cost). Référence visuelle : `DASHBOARD_DESIGN.md`, `themeDash.webp`. |
| **Exchange (OHLCV)** | **Binance** (API publique) pour le MVP : pas de clé requise pour les klines. URL : `https://api.binance.com/api/v3/klines?symbol=SYMBOL&interval=4h&limit=100`. Bybit possible en V1 (clé lecture seule si besoin). |

---

## 2. Exécution des agents

| Mécanisme | Description |
|-----------|--------------|
| **Cron OpenClaw** | Jobs définis dans `cron/jobs.json` (workspace `~/.openclaw`). Payload `kind: "agentTurn"` avec un `message` : l’agent reçoit la tâche et peut exécuter des commandes (ex. `node workspace/TradeEmpire/trading-empire/scripts/technicals-scan.js`). |
| **Lancement manuel** | Depuis la racine du workspace : `node workspace/TradeEmpire/trading-empire/scripts/technicals-scan.js` ou `openclaw cron run tradeempire-technicals`. |
| **Ordre des appels (V1)** | TECHNICALS (08:15) → SMART_MONEY (08:25) → SENTIMENT_X (08:35) → ORCHESTRATOR (08:45) → RISK_JOURNAL (08:55). Chaque job peut appeler un script dédié ou l’agent avec un message. |
| **Modèle LLM par agent** | Voir `AGENTS_LLM_MODELS.md`. Pour le MVP, TECHNICALS peut être un script déterministe (sans LLM) ; en V1 on branche l’agent + config `agents_models.json`. |

---

## 3. Connecteur OHLCV (MVP)

| Élément | Détail |
|---------|--------|
| **API** | Binance REST : `GET /api/v3/klines?symbol=BTCUSDT&interval=4h&limit=100`. Réponse : tableau de [openTime, open, high, low, close, volume, ...]. |
| **Implémentation** | Script Node.js `scripts/fetch-ohlcv.js` (ou intégré dans `technicals-scan.js`) : `fetch` ou `https.get`, parse JSON, retourne les bougies. |
| **Clés** | Aucune pour Binance klines (public). En V1 si Bybit : clé API en lecture seule dans `.env` ou `config` (ne jamais commiter). |
| **Sortie** | Soit en mémoire pour calcul technique, soit fichier intermédiaire `data/raw/ohlcv_BTCUSDT_4h.json`. Le script TECHNICALS écrit dans `data/signals/technicals/BTCUSDT_4h_<timestamp>.json`. |

---

## 4. Format de sortie TECHNICALS (signal)

Conforme au PRD §4.2. Fichier : `data/signals/technicals/{symbol}_{tf}_{timestamp}.json`.

Champs minimaux pour le MVP :
- `timestamp_utc` (ISO)
- `symbol`, `timeframe`
- `trend` : "up" | "down" | "range"
- `levels` : `{ "support": number[], "resistance": number[] }`
- `volatility` : number (ex. ATR ou écart type des closes)
- `setup_candidates` : tableau (peut être vide en MVP)
- `sources` : `[{ "type": "exchange", "ref": "binance_klines_4h" }]`

Calcul simplifié MVP : trend = pente des N dernières closes (régression linéaire ou comparaison close[0] vs close[N]); support/resistance = min/max locaux sur les N bougies; volatilité = écart-type des closes.

---

## 5. Arborescence du projet (MVP)

```
workspace/TradeEmpire/
  PRD.md, idea.txt, DASHBOARD_DESIGN.md, AGENTS_LLM_MODELS.md, ETAPE_SUIVANTE.md
  TECHNICAL_DESIGN.md, BACKLOG.md
  trading-empire/                    # Répertoire applicatif
    README.md
    project.md
    rules/
      risk_rules.md, strategy_rules.md, execution_policy.md
    data/
      signals/
        technicals/                  # Sortie TECHNICALS (MVP)
        sentiment/
        smart_money/
      ideas/
      decisions/
      journal/
      dashboard/
    scripts/
      fetch-ohlcv.js                 # Récupère klines Binance
      technicals-scan.js             # OHLCV → calcul → signal JSON
    agents/                          # Squelettes pour V1
      boss/, orchestrator/, sentiment_x/, smart_money/, technicals/, risk_journal/
```

Les crons et le gateway pointent vers le workspace `~/.openclaw/workspace` ; les scripts utilisent des chemins relatifs au répertoire `trading-empire/` ou absolus depuis le workspace.

---

## 6. Points d’intégration (MVP)

- **Binance** : appel HTTP depuis `fetch-ohlcv.js` ou `technicals-scan.js`.
- **Fichier** : écriture directe dans `data/signals/technicals/` depuis le script Node.
- **Cron** : job `tradeempire-technicals` dans `cron/jobs.json` qui exécute `node workspace/TradeEmpire/trading-empire/scripts/technicals-scan.js` (ou qui envoie un agentTurn avec message « exécute ce script »). Pour un MVP 100 % débogué sans dépendance au gateway, on privilégie l’exécution directe du script depuis le cron (si OpenClaw supporte `kind: "command"` ou équivalent) ou un cron système (crontab) qui lance le script. À défaut, agentTurn qui lance le script.

Vérification dans la doc OpenClaw : les jobs existants utilisent tous agentTurn + message. Donc pour le MVP on peut soit (a) ajouter un job qui dit « exécute node .../technicals-scan.js et réponds OK », soit (b) faire un crontab système qui appelle le script. Option (a) pour rester dans OpenClaw. Le script doit être autonome et écrire le fichier ; l’agent ne fait que lancer le script et renvoyer le résultat.

---

## 7. Sécurité et secrets (rappel)

- Aucune clé pour le MVP (Binance public).
- En V1 : clés API (exchange, X) dans `workspace/.env` ou variables d’environnement, jamais dans le repo. ClawRouter wallet dans `~/.openclaw/blockrun/wallet.key`.
