# Clés API — TradeEmpire

Référence : `workspace/.env` (racine OpenClaw). Ce document indique ce qui est **déjà branchable** et ce qu’il **faut chercher**.

---

## Déjà disponibles dans workspace/.env

| Variable | Usage actuel OpenClaw | Branchable TradeEmpire |
|----------|------------------------|-------------------------|
| **X_API_KEY**, **X_API_SECRET**, **X_ACCESS_TOKEN**, **X_ACCESS_SECRET**, **X_BEARER_TOKEN**, **X_CLIENT_ID**, **X_CLIENT_SECRET** | Compte X (@claude_rosi), API Twitter | **Branché** — SENTIMENT_X utilise `X_BEARER_TOKEN` (workspace/.env) pour Twitter API v2 search/recent ; `scripts/load-workspace-env.js` charge le .env. |
| **AISA_API_KEY** | Skills ClawHub (AIsa, twitter-search, us-stock-analyst) | **Optionnel** — OpenClaw Intel ou sentiment si l’API expose recherche Twitter / veille. |
| **HA_TOKEN**, **HA_URL** | Home Assistant | Non (hors périmètre trading). |
| **WALLET_***, **ARBITRUM_RPC_URL**, **DTO_API_URL**, **THE_GRAPH_API_KEY** | DTO / Arbitrum | Non (DTO, pas TradeEmpire). |
| **HYPERLIQUID_WALLET**, **HYPERLIQUID_SECRET** | TradeEmpire — Hyperliquid API wallet | **Branché** — pour requêtes signées (info user, vaults, ordres). Chargé via `load-workspace-env.js`. |
| **IMAP_***, **MY_EMAIL** | Emails / todo | Non (hors périmètre). |

---

## Déjà branché (sans clé)

- **Binance** : klines (OHLCV) et premiumIndex (funding) en **API publique** — pas de clé nécessaire. Utilisé par TECHNICALS et SMART_MONEY.

---

## Calendrier économique (Intel / Daphnée)

| Variable | Usage | Où la mettre |
|----------|--------|---------------|
| **RAPIDAPI_KEY** | Clé X-RapidAPI-Key pour **Ultimate Economic Calendar** (RapidAPI). Utilisée par `economic-calendar-scan.js` pour récupérer les événements macro (pays, date, actual/forecast/previous). | `workspace/.env` — même valeur que **X-RapidAPI-Key** sur RapidAPI (App → Ultimate Economic Calendar). Ex. `RAPIDAPI_KEY=9bbdcb7ca9mshc32cf7f61c9818cp106d63jsnc3121624950a` |
| **JBLANKED_API_KEY** | (Optionnel) Calendrier JBlanked / Forex Factory si tu n’utilises pas RapidAPI. | `workspace/.env` — clé depuis jblanked.com/api/key |

L’hôte RapidAPI est fixe : `ultimate-economic-calendar.p.rapidapi.com` (pas besoin de variable d’env).

La même **RAPIDAPI_KEY** est utilisée par **Alicia (Technicals)** pour :
- **TradingView** : `tradingview18.p.rapidapi.com` — endpoint `symbols/get-events-calendar` (calendrier d’événements par symbole). Voir `scripts/tradingview-events-calendar.js`.
- **Crypto Trading Indicators** : `crypto-technical-analysis-indicator-apis-for-trading.p.rapidapi.com` — endpoints `/rsi`, `/macd`, `/ema` (indicateurs RSI, MACD, EMA par symbole). Voir `scripts/crypto-indicators-rapidapi.js`. Attention aux limites de requêtes (rate limit) ; le script espace les appels entre symboles.
- **CryptoDaily** (Daphnée/Intel) : `cryptocurrency-news2.p.rapidapi.com` — GET `/v1/cryptodaily` (actualités crypto du jour). Voir `scripts/cryptodaily-news.js`. Certains plans RapidAPI peuvent renvoyer 402 Payment required ; le script enregistre l’erreur et écrit quand même le fichier de sortie.
- **Reddit** (Daphnée/Intel) : `reddit34.p.rapidapi.com` — GET `/getSimilarSubreddits?subreddit=XXX` (subreddits similaires, ex. cryptocurrency, bitcoin, ethereum). Voir `scripts/reddit-intel.js`. Même `RAPIDAPI_KEY`.
- **YouTube Search** (Daphnée/Intel) : scrape quotidien — top 30–50 vidéos crypto (veille si API Google). Même `RAPIDAPI_KEY` en fallback. Optionnel : `INTEL_YOUTUBE_RAPIDAPI_HOST` (host RapidAPI si différent). Limites : `INTEL_YOUTUBE_VIDEOS_PER_DAY` (défaut 50), `INTEL_YOUTUBE_MAX_CARDS` (défaut 30 cartes avec transcript).
- **Dexscreener Top Traders** (Lucas/Smart Money) : `dexscreener-top-traders.p.rapidapi.com` — GET `/get_holders?wallet_url=...` (holders / top traders pour un wallet). Même `RAPIDAPI_KEY`. Paramètre requis : `wallet_url` (URL complète commençant par `https://dexscreener.com/`). Optionnel dans `.env` : `DEXSCREENER_WALLET_URL`. Doc : [RapidAPI — Dexscreener Top Traders](https://rapidapi.com/scrapewizard-scrapewizard-default/api/dexscreener-top-traders). Détails : `docs/DEXSCREENER_TOP_TRADERS.md`. Script : `scripts/dexscreener-top-traders.js`.
- **Binance Copy Trading Leaderboard** (Lucas/Smart Money) : `binance-copy-trading-leaderboard-api.p.rapidapi.com` — POST `/futures/v1/lead-portfolio` (détail portfolio) **fonctionne** ; GET `/futures/v1/leaderboard` avec `{ portfolioId }` (détail d’un portfolio). Même `RAPIDAPI_KEY`. Liste de portfolios : `BINANCE_COPY_PORTFOLIO_IDS` (virgules) ou fichier `data/signals/smart_money/binance_copy_portfolio_ids.txt` (un ID par ligne). IDs depuis Binance Copy Trading > Leaderboard. Doc : [RapidAPI — Binance Copy Trading Leaderboard API](https://rapidapi.com/udaydeepyadav/api/binance-copy-trading-leaderboard-api). Script : `scripts/binance-copy-leaderboard.js`. Attention au rate limit (429) ; le script espace les appels POST.
- **Découverte des listes (délégation agent)** : **Apify** — `APIFY_API_TOKEN` (ou `APIFY_TOKEN`) dans `workspace/.env`. Scripts `smart-money-discover-wallets.js` et `smart-money-discover-portfolios.js` remplissent `dexscreener_wallets.txt` et `binance_copy_portfolio_ids.txt` via Apify (acteurs Dexscreener Top Traders Scraper, Binance Copy Trading Scraper). Seeds wallets : `dexscreener_seed_tokens.txt` (lignes `chain,address`) ou `DEXSCREENER_SEED_TOKENS`. Exécutés dans run-morning avant les scripts qui lisent ces listes.

---

## À chercher / à créer

| Besoin | Variable suggérée | Où la chercher |
|--------|-------------------|-----------------|
| **Telegram** (notifications brief, alertes) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (ou via OpenClaw channels) | Bot Father → nouveau bot → token ; chat_id = ID du canal ou du groupe. OpenClaw peut déjà gérer Telegram (delivery) — vérifier `openclaw channels` / config. |
| **Bybit** (funding, OI, optionnel) | `BYBIT_API_KEY`, `BYBIT_API_SECRET` | Bybit → API Management → clé lecture seule (pas de trading). |
| **Binance** (trading V2, optionnel) | `BINANCE_API_KEY`, `BINANCE_API_SECRET` | Binance → API Management → clé avec droits limités si exécution future. Pas nécessaire pour signaux (déjà public). |
| **OpenAI / autre LLM** (si hors ClawRouter) | Déjà géré par OpenClaw / ClawRouter | Rien à ajouter pour TradeEmpire si on reste sur ClawRouter. |

---

## Résumé

- **Branché** : **X (Twitter)** — `X_BEARER_TOKEN` lu depuis workspace/.env ; SENTIMENT_X appelle Twitter API v2 search/recent (crypto/bitcoin), dérive narratives (bullish/bearish/ETF).
- **Binance** : `BINANCE_API_KEY`, `BINANCE_API_SECRET` dans `workspace/.env` — pour smart_money (données avancées) et top trader. OHLCV et funding restent disponibles en public sans clé.
- **Exécution (V2)** : **ASTER** — clés dans `DTO/app/.env` (`ASTER_API_KEY`, `ASTER_SECRET_KEY`). TradeEmpire charge ce .env et utilise `scripts/aster-client.js` pour placer les ordres. Voir `docs/EXECUTION_ASTER.md`.
- **Hyperliquid** : `HYPERLIQUID_WALLET`, `HYPERLIQUID_SECRET` dans `workspace/.env` — API wallet (adresse + clé privée pour signature). Utilisable pour requêtes signées (ex. leadingVaults avec user, ordres, etc.).
- **À chercher si besoin** : Telegram (notifications), Bybit (optionnel).
