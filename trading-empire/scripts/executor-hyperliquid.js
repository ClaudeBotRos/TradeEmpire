#!/usr/bin/env node
/**
 * TradeEmpire — Exécuteur des ordres Hyperliquid (actifs tokenisés, HIP-3).
 * Lit la file data/dashboard/hyperliquid_orders_queue.json,
 * place les ordres via le SDK Hyperliquid (HYPERLIQUID_WALLET, HYPERLIQUID_SECRET),
 * enregistre les résultats dans data/dashboard/executed_orders_hyperliquid.json.
 * Ordre minimum 10 USD sur Hyperliquid.
 * Usage: node scripts/executor-hyperliquid.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'dashboard', 'hyperliquid_orders_queue.json');
const EXECUTED_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders_hyperliquid.json');
const COMMODITIES_PATH = path.join(ROOT, 'data', 'hyperliquid', 'commodities_meta.json');
const MIN_ORDER_USD = 10;

function readJson(p, def = null) {
  if (!fs.existsSync(p)) return def;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return def;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

/** Retourne le prix de référence (mark) pour un symbole depuis commodities_meta. */
function getMarkPrice(symbol, commodities) {
  if (!symbol || !Array.isArray(commodities)) return null;
  const s = String(symbol).trim();
  const c = commodities.find((x) => (x.name || '').toUpperCase() === s.toUpperCase());
  return c && c.markPx != null ? String(c.markPx) : null;
}

/** Symbole queue → coin SDK. Main dex perp = "GAS" → "GAS-PERP", HIP-3 = "xyz:GOLD" conservé. */
function symbolToCoin(symbol) {
  const s = (symbol || '').trim();
  if (!s) return null;
  if (s.includes(':')) return s; // HIP-3
  return s.endsWith('-PERP') ? s : `${s}-PERP`;
}

async function main() {
  const wallet = (process.env.HYPERLIQUID_WALLET || '').trim();
  let secret = (process.env.HYPERLIQUID_SECRET || '').trim();
  if (!wallet || !secret) {
    console.log('Hyperliquid executor : HYPERLIQUID_WALLET ou HYPERLIQUID_SECRET manquant dans workspace/.env. Aucun ordre placé.');
    return;
  }
  if (!secret.startsWith('0x')) secret = '0x' + secret;

  let queueRaw = readJson(QUEUE_PATH);
  let queueList = Array.isArray(queueRaw) ? queueRaw : queueRaw?.orders ? queueRaw.orders : [];
  const commodities = readJson(COMMODITIES_PATH, {}).commodities || [];

  // Si la file est vide, remplir depuis les recommandations Eva (hyperliquid_analyst_report.json)
  if (queueList.filter((o) => o && (o.symbol || o.coin) && !o.executed).length === 0) {
    const reportPath = path.join(ROOT, 'data', 'dashboard', 'hyperliquid_analyst_report.json');
    const report = readJson(reportPath);
    const recs = report?.recommendations || [];
    if (recs.length > 0) {
      const autoOrders = [];
      for (const r of recs) {
        const symbol = r.symbol;
        if (!symbol) continue;
        let side = (r.side || 'buy').toString().toLowerCase();
        if (side === '—' || side === '-' || side === '') side = 'buy';
        const markPx = getMarkPrice(symbol, commodities);
        if (!markPx || Number(markPx) <= 0) continue;
        const minSz = (MIN_ORDER_USD / Number(markPx)).toFixed(4);
        autoOrders.push({
          symbol,
          side: side === 'sell' || side === 'short' ? 'sell' : 'buy',
          sz: minSz,
          limit_px: markPx,
          from_report: true,
          reason: r.reason || '',
        });
      }
      if (autoOrders.length > 0) {
        queueRaw = autoOrders;
        queueList = autoOrders;
        writeJson(QUEUE_PATH, queueRaw);
        console.log('Hyperliquid executor : file remplie depuis rapport Eva :', autoOrders.length, 'ordre(s).');
      }
    }
  }

  const pending = queueList.filter((o) => o && (o.symbol || o.coin) && !o.executed);
  if (pending.length === 0) {
    console.log('Hyperliquid executor : aucun ordre en file. Fichier attendu :', QUEUE_PATH, '(ou recommandations dans hyperliquid_analyst_report.json).');
    return;
  }
  const executed = readJson(EXECUTED_PATH);
  const executedList = Array.isArray(executed) ? executed : (executed?.orders ? executed.orders : []);

  let Hyperliquid;
  try {
    Hyperliquid = require('hyperliquid').Hyperliquid;
  } catch (e) {
    console.log('Hyperliquid executor : module hyperliquid introuvable. npm install hyperliquid. Erreur :', (e && e.message) || e);
    return;
  }

  const sdk = new Hyperliquid({
    privateKey: secret,
    testnet: false,
    enableWs: false,
    disableAssetMapRefresh: true,
  });

  const remainingInQueue = [];
  let placed = 0;
  let errors = 0;

  for (const order of queueList) {
    if (order.executed) {
      remainingInQueue.push(order);
      continue;
    }
    const symbol = order.symbol || order.coin;
    const side = (order.side || order.dir || order.direction || 'buy').toString().toLowerCase();
    const is_buy = side === 'buy' || side === 'long';
    let sz = order.sz ?? order.size;
    if (sz == null) sz = order.notional_usd ? String(Number(order.notional_usd).toFixed(4)) : null;
    if (sz == null || (Number(sz) <= 0)) {
      console.log('Hyperliquid executor : ordre ignoré (sz manquant ou invalide) :', symbol, side);
      remainingInQueue.push(order);
      continue;
    }
    sz = String(sz);
    let limit_px = order.limit_px ?? order.price ?? order.p;
    if (limit_px == null || limit_px === '') {
      limit_px = getMarkPrice(symbol, commodities);
      if (limit_px == null) {
        console.log('Hyperliquid executor : pas de prix pour', symbol, '— fournir limit_px dans la file ou exécuter hyperliquid-commodities-scan.js.');
        remainingInQueue.push(order);
        continue;
      }
    }
    limit_px = String(limit_px);
    const notional = Number(sz) * Number(limit_px);
    if (notional < MIN_ORDER_USD - 0.01) {
      console.log('Hyperliquid executor : ordre ignoré (min 10 USD) :', symbol, 'sz=', sz, 'px=', limit_px, '→', notional.toFixed(2), 'USD');
      remainingInQueue.push(order);
      continue;
    }

    const coin = symbolToCoin(symbol);
    if (!coin) {
      console.log('Hyperliquid executor : symbole invalide :', symbol);
      remainingInQueue.push(order);
      continue;
    }

    try {
      const result = await sdk.exchange.placeOrder({
        coin,
        is_buy,
        sz,
        limit_px,
        order_type: { limit: { tif: 'Gtc' } },
        reduce_only: false,
      });
      const statuses = result?.response?.data?.statuses || [];
      const first = statuses[0];
      let status = 'sent';
      let oid = null;
      let errMsg = null;
      if (first && typeof first === 'object') {
        if (first.filled) {
          status = 'filled';
          oid = first.filled.oid;
        } else if (first.resting) {
          status = 'resting';
          oid = first.resting.oid;
        } else if (first.error) {
          errMsg = first.error;
          status = 'error';
        }
      }
      executedList.push({
        symbol,
        coin,
        side: is_buy ? 'buy' : 'sell',
        sz,
        limit_px,
        requested_at: new Date().toISOString(),
        status,
        oid,
        response: result?.response || null,
        error: errMsg || null,
      });
      if (status === 'error') {
        console.log('Hyperliquid executor : erreur ordre', symbol, ':', errMsg);
        errors++;
      } else {
        console.log('Hyperliquid executor : ordre placé', symbol, is_buy ? 'buy' : 'sell', sz, '@', limit_px, '→', status, oid != null ? `oid=${oid}` : '');
        placed++;
      }
      remainingInQueue.push({ ...order, executed: true, executed_at: new Date().toISOString(), status, oid });
    } catch (e) {
      const msg = (e && e.message) || String(e);
      console.log('Hyperliquid executor : exception', symbol, ':', msg);
      executedList.push({
        symbol,
        coin,
        side: is_buy ? 'buy' : 'sell',
        sz,
        limit_px,
        requested_at: new Date().toISOString(),
        status: 'error',
        error: msg,
      });
      remainingInQueue.push(order);
      errors++;
    }
  }

  writeJson(EXECUTED_PATH, { updated_at: new Date().toISOString(), orders: executedList });
  writeJson(QUEUE_PATH, Array.isArray(queueRaw) ? remainingInQueue : { ...queueRaw, orders: remainingInQueue });
  console.log('Hyperliquid executor :', placed, 'ordre(s) placé(s),', errors, 'erreur(s). Fichier :', EXECUTED_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
