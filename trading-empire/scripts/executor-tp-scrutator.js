#!/usr/bin/env node
/**
 * TradeEmpire — Scrutateur TP (comme DTO).
 * Lit executor_pending_tp.json : pour chaque entrée (ordre d'entrée), vérifie si l'ordre est FILLED.
 * Si FILLED : place l'ordre TP (LIMIT reduceOnly) puis retire le niveau des pending.
 * Si CANCELED/EXPIRED/REJECTED : retire le niveau.
 * Met à jour executed_orders.json avec tp_order_id quand un TP est placé.
 * Usage: node scripts/executor-tp-scrutator.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PENDING_TP_PATH = path.join(ROOT, 'data', 'dashboard', 'executor_pending_tp.json');
const EXECUTED_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');

function loadPendingTp() {
  if (!fs.existsSync(PENDING_TP_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(PENDING_TP_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function savePendingTp(list) {
  const dir = path.dirname(PENDING_TP_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PENDING_TP_PATH, JSON.stringify(list, null, 2), 'utf8');
}

function loadExecuted() {
  if (!fs.existsSync(EXECUTED_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(EXECUTED_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveExecuted(list) {
  const dir = path.dirname(EXECUTED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EXECUTED_PATH, JSON.stringify(list, null, 2), 'utf8');
}

function formatPrice(value, pricePrecision) {
  const decimals = Math.max(0, parseInt(pricePrecision, 10) || 2);
  return Number(value).toFixed(decimals);
}

async function main() {
  const aster = require('./aster-client.js');
  const { getOrder, placeOrder, getExchangeInfo, getSymbolPrecision } = aster;

  let exchangeInfo;
  try {
    exchangeInfo = await getExchangeInfo();
  } catch (e) {
    console.error('ExchangeInfo:', e.message);
    process.exit(1);
  }

  const pending = loadPendingTp();
  if (pending.length === 0) {
    console.log('Aucun TP en attente.');
    return;
  }

  console.log('Scrutateur TP:', pending.length, 'niveau(x) en attente.');
  const toRemove = [];
  let placed = 0;
  const errors = [];

  for (const level of pending) {
    const { entryOrderId, symbol, side, quantity, takeProfitPrice, trade_id } = level;
    if (!symbol || entryOrderId == null) {
      toRemove.push(level);
      continue;
    }
    try {
      const order = await getOrder(symbol, entryOrderId);
      if (order.status !== 'FILLED') {
        if (order.status === 'CANCELED' || order.status === 'EXPIRED' || order.status === 'REJECTED') {
          toRemove.push(level);
          console.log('TP scrutator:', symbol, 'ordre', entryOrderId, order.status, '→ niveau retiré.');
        }
        continue;
      }

      const { pricePrecision = 2 } = getSymbolPrecision(exchangeInfo, symbol);
      const priceStr = formatPrice(takeProfitPrice, pricePrecision);
      const isLong = side === 'long';
      const tpResult =
        isLong
          ? await placeOrder({
              symbol,
              side: 'SELL',
              type: 'LIMIT',
              timeInForce: 'GTC',
              quantity,
              price: priceStr,
              reduceOnly: true,
            })
          : await placeOrder({
              symbol,
              side: 'BUY',
              type: 'LIMIT',
              timeInForce: 'GTC',
              quantity,
              price: priceStr,
              reduceOnly: true,
            });

      const tpOrderId = tpResult?.orderId ?? tpResult?.orderid;
      toRemove.push(level);
      placed++;
      console.log('TP scrutator: TP', side, 'placé pour entry', entryOrderId, '→ orderId', tpOrderId, symbol);

      const executed = loadExecuted();
      const row = executed.find((r) => r.entry_order_id === entryOrderId || r.entry_order_id === String(entryOrderId));
      if (row) {
        row.tp_order_id = tpOrderId;
        saveExecuted(executed);
      }
    } catch (err) {
      const msg = String(err?.message || err);
      errors.push(`${symbol} entry ${entryOrderId}: ${msg}`);
    }
  }

  if (toRemove.length > 0) {
    const next = pending.filter((p) => !toRemove.includes(p));
    savePendingTp(next);
  }
  if (placed > 0) console.log('TP scrutator:', placed, 'TP placé(s).');
  errors.forEach((e) => console.warn('TP scrutator:', e));
}

main()
  .then(() => {
    try {
      require('child_process').execSync(
        `node "${path.join(__dirname, 'tibo-report.js')}" scrutator`,
        { cwd: path.join(__dirname, '..'), stdio: 'ignore' }
      );
    } catch (_) {}
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
