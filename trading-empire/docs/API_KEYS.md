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
