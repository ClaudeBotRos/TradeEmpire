# Exécution des ordres — ASTER (AsterDEX)

TradeEmpire V2 utilisera **ASTER** (AsterDEX futures) pour l’exécution des ordres. Les clés API sont déjà présentes dans le projet **DTO** ; on réutilise la même connexion.

---

## Connexion (réutiliser DTO)

- **Clés** : `ASTER_API_KEY`, `ASTER_SECRET_KEY` (dans `workspace/DTO/app/.env`).
- **Base URL** : `ASTER_BASE_URL` ou par défaut `https://fapi.asterdex.com`.
- **Auth** : HMAC-SHA256 sur la query (params + `timestamp` + `recvWindow`), header `X-MBX-APIKEY` = clé API. Même schéma que le client DTO (`workspace/DTO/app/src/aster/client.ts`).

TradeEmpire charge le `.env` du workspace puis **DTO/app/.env** via `scripts/load-workspace-env.js`, donc les clés ASTER sont disponibles dans les scripts sans duplication.

---

## Client TradeEmpire

- **`scripts/aster-client.js`** : client minimal (Node, CommonJS) qui expose :
  - `getAccount()` — balance, positions
  - `getMarkPrice(symbol)` — prix mark (public)
  - `placeOrder({ symbol, side, type, quantity, price, reduceOnly? })` — ordre limit GTC
  - `placeStopMarketOrder({ symbol, side, quantity, stopPrice })` — ordre stop market
  - `getOpenOrders(symbol)`, `cancelOrder(symbol, orderId)`, `setLeverage(symbol, leverage)`

Utilisé par l’**Executor** en V2 pour passer les ordres issus des idées APPROVED (entry limit, stop loss, take profit).

---

## Endpoints ASTER (référence DTO)

| Méthode | Endpoint | Usage |
|--------|----------|--------|
| GET | `/fapi/v1/premiumIndex?symbol=` | Prix mark (public) |
| GET | `/fapi/v1/ticker/price?symbol=` | Dernier prix (public) |
| GET | `/fapi/v1/exchangeInfo` | Symboles, filters (public) |
| GET | `/fapi/v2/balance` | Balance (signé) |
| GET | `/fapi/v2/positionRisk` | Positions (signé) |
| GET | `/fapi/v1/openOrders?symbol=` | Ordres ouverts (signé) |
| POST | `/fapi/v1/order` | Placer ordre (signé) |
| DELETE | `/fapi/v1/order?symbol=&orderId=` | Annuler ordre (signé) |
| POST | `/fapi/v1/leverage?symbol=&leverage=` | Définir levier (signé) |

---

## Règles V2 (rappel)

- Exécution uniquement si idée **APPROVED** par RISK_JOURNAL.
- Respect des `risk_rules` (taille position, max loss, leverage).
- Pas d’ordre envoyé sans validation humaine en V1 ; en V2, l’Executor appelle le client ASTER après contrôles.
