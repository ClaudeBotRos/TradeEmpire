/**
 * Client ASTER (AsterDEX futures) pour TradeEmpire — exécution des ordres V2.
 * Même auth que DTO : HMAC-SHA256, X-MBX-APIKEY. Charge env via load-workspace-env (workspace + DTO/app/.env).
 */

require('./load-workspace-env.js');
const crypto = require('crypto');

const BASE = (process.env.ASTER_BASE_URL || 'https://fapi.asterdex.com').replace(/\/$/, '');
const RECV_WINDOW = String(process.env.ASTER_RECV_WINDOW || 15000);

function getConfig() {
  const apiKey = (process.env.ASTER_API_KEY || '').trim();
  const apiSecret = (process.env.ASTER_SECRET_KEY || '').trim();
  return { apiKey, apiSecret };
}

function signedRequest(method, path, params = {}) {
  const { apiKey, apiSecret } = getConfig();
  if (!apiKey || !apiSecret) {
    return Promise.reject(new Error('ASTER_API_KEY et ASTER_SECRET_KEY requis (DTO/app/.env ou workspace/.env).'));
  }
  const timestamp = String(Date.now());
  const all = { ...params, timestamp, recvWindow: RECV_WINDOW };
  const query = new URLSearchParams(all).toString();
  const signature = crypto.createHmac('sha256', apiSecret).update(query).digest('hex');
  const url = `${BASE}${path}?${query}&signature=${signature}`;

  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-MBX-APIKEY': apiKey },
  }).then(async (r) => {
    const text = await r.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`ASTER API: invalid JSON ${text?.slice(0, 200)}`);
    }
    if (!r.ok) {
      const msg = data?.msg ?? data?.message ?? text;
      throw new Error(`ASTER API ${r.status}: ${msg}`);
    }
    return data;
  });
}

/** Prix mark (public). */
async function getMarkPrice(symbol) {
  const url = `${BASE}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(String(symbol).toUpperCase())}`;
  const res = await fetch(url).then((r) => r.json());
  const arr = Array.isArray(res) ? res : [res];
  const one = arr.find((x) => x?.symbol === String(symbol).toUpperCase()) ?? arr[0];
  const p = one?.markPrice ?? res?.markPrice;
  return p ? Number(p) : 0;
}

/** Balance et positions (signé). */
async function getAccount() {
  const [balanceData, positionData] = await Promise.all([
    signedRequest('GET', '/fapi/v2/balance'),
    signedRequest('GET', '/fapi/v2/positionRisk', {}),
  ]);
  const assets = Array.isArray(balanceData) ? balanceData : [balanceData];
  const usdt = assets.find((a) => a.asset === 'USDT');
  const positions = (Array.isArray(positionData) ? positionData : []).map((p) => ({
    symbol: p.symbol,
    positionAmt: p.positionAmt ?? '0',
    entryPrice: p.entryPrice ?? '0',
    markPrice: p.markPrice,
    unrealizedProfit: p.unRealizedProfit ?? p.unrealizedProfit ?? '0',
    leverage: p.leverage ?? '0',
  }));
  return {
    totalWalletBalance: usdt?.balance ?? '0',
    availableBalance: usdt?.availableBalance ?? usdt?.balance ?? '0',
    totalUnrealizedProfit: usdt?.crossUnPnl ?? '0',
    positions,
  };
}

/** Ordres ouverts (signé). */
async function getOpenOrders(symbol) {
  const data = await signedRequest('GET', '/fapi/v1/openOrders', {
    symbol: String(symbol).toUpperCase(),
  });
  const raw = Array.isArray(data) ? data : (data?.orders ?? []);
  return raw.map((o) => ({
    orderId: o.orderId,
    symbol: o.symbol,
    side: o.side,
    price: o.price ?? '',
    origQty: o.origQty ?? '',
    status: o.status ?? 'NEW',
    type: o.type ?? o.origType ?? 'LIMIT',
  }));
}

/** Placer ordre limit GTC (signé). */
async function placeOrder(params) {
  const body = {
    symbol: String(params.symbol).toUpperCase(),
    side: params.side,
    type: params.type || 'LIMIT',
    timeInForce: params.timeInForce || 'GTC',
    quantity: String(params.quantity),
    price: String(params.price),
  };
  if (params.reduceOnly === true) body.reduceOnly = 'true';
  return signedRequest('POST', '/fapi/v1/order', body);
}

/** Placer ordre STOP_MARKET (signé). */
async function placeStopMarketOrder(params) {
  const body = {
    symbol: String(params.symbol).toUpperCase(),
    side: params.side,
    type: 'STOP_MARKET',
    quantity: String(params.quantity),
    stopPrice: String(params.stopPrice),
  };
  return signedRequest('POST', '/fapi/v1/order', body);
}

/** Annuler un ordre (signé). */
async function cancelOrder(symbol, orderId) {
  return signedRequest('DELETE', '/fapi/v1/order', {
    symbol: String(symbol).toUpperCase(),
    orderId: String(orderId),
  });
}

/** Définir le levier (signé). */
async function setLeverage(symbol, leverage) {
  return signedRequest('POST', '/fapi/v1/leverage', {
    symbol: String(symbol).toUpperCase(),
    leverage: String(leverage),
  });
}

module.exports = {
  getMarkPrice,
  getAccount,
  getOpenOrders,
  placeOrder,
  placeStopMarketOrder,
  cancelOrder,
  setLeverage,
  getConfig,
};
