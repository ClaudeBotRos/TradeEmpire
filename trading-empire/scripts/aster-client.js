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

/** Exchange info (public) — symboles, quantityPrecision, pricePrecision. */
async function getExchangeInfo() {
  const url = `${BASE}/fapi/v1/exchangeInfo`;
  const res = await fetch(url).then((r) => r.json());
  if (!res || !res.symbols) throw new Error('ASTER exchangeInfo: invalid response');
  return res;
}

/** Précisions quantité/prix pour un symbole (pour arrondir ordres). Inclut minNotional (MIN_NOTIONAL) comme DTO. */
function getSymbolPrecision(exchangeInfo, symbol) {
  const sym = String(symbol).toUpperCase();
  const s = (exchangeInfo.symbols || []).find((x) => x.symbol === sym);
  if (!s) return { quantityPrecision: 3, pricePrecision: 2, minQty: 0, stepSize: 0.001, minNotional: 5 };
  const qty = Math.max(0, parseInt(s.quantityPrecision, 10) || 3);
  const pr = Math.max(0, parseInt(s.pricePrecision, 10) ?? 2);
  let minQty = 0;
  let stepSize = 0.001;
  let minNotional = 5;
  const lotSize = (s.filters || []).find((f) => f.filterType === 'LOT_SIZE');
  if (lotSize) {
    minQty = parseFloat(lotSize.minQty) || 0;
    stepSize = parseFloat(lotSize.stepSize) || 0.001;
  }
  const minNotionalFilter = (s.filters || []).find((f) => f.filterType === 'MIN_NOTIONAL');
  if (minNotionalFilter && typeof minNotionalFilter.notional !== 'undefined') minNotional = parseFloat(minNotionalFilter.notional) || 5;
  return { quantityPrecision: qty, pricePrecision: pr, minQty, stepSize, minNotional };
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

/** Ordres ouverts (signé). Si symbol est omis, renvoie tous les ordres ouverts (API Binance-style). */
async function getOpenOrders(symbol) {
  const params = symbol ? { symbol: String(symbol).toUpperCase() } : {};
  const data = await signedRequest('GET', '/fapi/v1/openOrders', params);
  const raw = Array.isArray(data) ? data : (data?.orders ?? []);
  return raw.map((o) => ({
    orderId: o.orderId,
    symbol: o.symbol,
    side: o.side,
    price: o.price ?? '',
    stopPrice: o.stopPrice ?? '',
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

/** Placer ordre STOP_MARKET (signé). Utilisable pour entrée trigger : quand le prix atteint stopPrice, exécution au marché. */
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

/** Placer ordre MARKET (exécution immédiate au prix du marché). Utilisé en fallback si tick size invalide. */
async function placeMarketOrder(params) {
  const body = {
    symbol: String(params.symbol).toUpperCase(),
    side: params.side,
    type: 'MARKET',
    quantity: String(params.quantity),
  };
  return signedRequest('POST', '/fapi/v1/order', body);
}

/** Placer ordre TAKE_PROFIT (trigger). Quand le prix atteint stopPrice, ordre limit à price. reduceOnly pour fermer une position. */
async function placeTakeProfitOrder(params) {
  const body = {
    symbol: String(params.symbol).toUpperCase(),
    side: params.side,
    type: 'TAKE_PROFIT',
    timeInForce: params.timeInForce || 'GTC',
    quantity: String(params.quantity),
    price: String(params.price),
    stopPrice: String(params.stopPrice),
  };
  if (params.reduceOnly === true) body.reduceOnly = 'true';
  return signedRequest('POST', '/fapi/v1/order', body);
}

/** Annuler un ordre (signé). */
async function cancelOrder(symbol, orderId) {
  return signedRequest('DELETE', '/fapi/v1/order', {
    symbol: String(symbol).toUpperCase(),
    orderId: String(orderId),
  });
}

/** Récupérer le statut d'un ordre (pour le scrutateur TP). */
async function getOrder(symbol, orderId) {
  const data = await signedRequest('GET', '/fapi/v1/order', {
    symbol: String(symbol).toUpperCase(),
    orderId: String(orderId),
  });
  return { status: data?.status ?? 'UNKNOWN' };
}

/** Historique des trades du compte pour un symbole (pour Chase : détecter SL/TP qui a clôturé). */
async function getUserTrades(symbol, opts = {}) {
  const params = { symbol: String(symbol).toUpperCase() };
  if (opts.orderId != null) params.orderId = opts.orderId;
  if (opts.startTime != null) params.startTime = opts.startTime;
  if (opts.endTime != null) params.endTime = opts.endTime;
  if (opts.limit != null) params.limit = Math.min(1000, Math.max(1, opts.limit));
  const data = await signedRequest('GET', '/fapi/v1/userTrades', params);
  return Array.isArray(data) ? data : [];
}

/** Définir le levier (signé). */
async function setLeverage(symbol, leverage) {
  return signedRequest('POST', '/fapi/v1/leverage', {
    symbol: String(symbol).toUpperCase(),
    leverage: String(leverage),
  });
}

/** Lire le levier actuellement configuré pour un symbole (signé). Retourne un nombre ou null si indisponible. */
async function getLeverage(symbol) {
  const sym = String(symbol).toUpperCase();
  const data = await signedRequest('GET', '/fapi/v2/positionRisk', { symbol: sym });
  const list = Array.isArray(data) ? data : [];
  const row = list.find((p) => (p.symbol || '').toUpperCase() === sym) || list[0];
  if (!row || row.leverage == null) return null;
  const lev = parseInt(String(row.leverage), 10);
  return Number.isFinite(lev) && lev > 0 ? lev : null;
}

/** Historique des revenus (Binance-style). incomeType: REALIZED_PNL, FUNDING_FEE, COMMISSION, etc. */
async function getIncome(opts = {}) {
  const params = {};
  if (opts.incomeType) params.incomeType = opts.incomeType;
  if (opts.symbol) params.symbol = String(opts.symbol).toUpperCase();
  if (opts.startTime != null) params.startTime = opts.startTime;
  if (opts.endTime != null) params.endTime = opts.endTime;
  if (opts.limit != null) params.limit = Math.min(1000, Math.max(1, opts.limit));
  const data = await signedRequest('GET', '/fapi/v1/income', params);
  return Array.isArray(data) ? data : [];
}

/** Somme du PnL réalisé USDT (pour dashboard balance). Pagine si besoin sur les 90 derniers jours. */
async function getRealizedPnlUsd() {
  const end = Date.now();
  const start = end - 90 * 24 * 60 * 60 * 1000;
  let total = 0;
  let list = await getIncome({ incomeType: 'REALIZED_PNL', startTime: start, endTime: end, limit: 1000 });
  for (const row of list) {
    if ((row.asset || '').toUpperCase() === 'USDT') {
      total += parseFloat(row.income || 0);
    }
  }
  while (list.length === 1000) {
    const lastTime = list[list.length - 1].time;
    list = await getIncome({ incomeType: 'REALIZED_PNL', startTime: start, endTime: lastTime - 1, limit: 1000 });
    for (const row of list) {
      if ((row.asset || '').toUpperCase() === 'USDT') total += parseFloat(row.income || 0);
    }
  }
  return total;
}

/** Résumé PnL réalisé depuis l’historique ASTER (position history / income REALIZED_PNL). Chaque ligne = une clôture. */
async function getRealizedPnlSummary(opts = {}) {
  const days = opts.days != null ? opts.days : 90;
  const end = Date.now();
  const start = end - days * 24 * 60 * 60 * 1000;
  let allRows = [];
  let list = await getIncome({ incomeType: 'REALIZED_PNL', startTime: start, endTime: end, limit: 1000 });
  for (const row of list) {
    if ((row.asset || '').toUpperCase() === 'USDT') allRows.push(row);
  }
  while (list.length === 1000) {
    const lastTime = list[list.length - 1].time;
    list = await getIncome({ incomeType: 'REALIZED_PNL', startTime: start, endTime: lastTime - 1, limit: 1000 });
    for (const row of list) {
      if ((row.asset || '').toUpperCase() === 'USDT') allRows.push(row);
    }
  }
  let totalUsdt = 0;
  let winCount = 0;
  let lossCount = 0;
  for (const row of allRows) {
    const inc = parseFloat(row.income || 0);
    totalUsdt += inc;
    if (inc > 0) winCount++;
    else if (inc < 0) lossCount++;
  }
  const tradesCount = allRows.length;
  const summary =
    tradesCount === 0
      ? 'Aucun trade clôturé sur ASTER (historique income).'
      : `${tradesCount} trade(s) clôturés sur ASTER : ${winCount} gagnant(s), ${lossCount} perdant(s). PnL réalisé total : ${totalUsdt.toFixed(2)} USDT.`;
  return {
    source: 'ASTER',
    trades_count: tradesCount,
    win_count: winCount,
    loss_count: lossCount,
    realized_pnl_usdt: totalUsdt,
    summary,
    fetched_at: new Date().toISOString(),
  };
}

module.exports = {
  getMarkPrice,
  getExchangeInfo,
  getSymbolPrecision,
  getAccount,
  getOpenOrders,
  getOrder,
  getUserTrades,
  getIncome,
  getRealizedPnlUsd,
  getRealizedPnlSummary,
  placeOrder,
  placeStopMarketOrder,
  placeMarketOrder,
  placeTakeProfitOrder,
  cancelOrder,
  setLeverage,
  getLeverage,
  getConfig,
};
