#!/usr/bin/env node
/**
 * TradeEmpire — Synchronise executed_orders.json avec l'état réel ASTER.
 * Pour chaque ordre dont le symbole n'a plus de position ouverte sur ASTER,
 * marque closed_on_aster: true (et closed_at si absent).
 * Le dashboard peut alors n'afficher que les ordres encore ouverts (?open=1).
 * Usage: node scripts/sync-executed-orders-with-aster.js
 * Ou: require('./sync-executed-orders-with-aster.js').runSync()
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXECUTED_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');

async function runSync() {
  if (!fs.existsSync(EXECUTED_PATH)) return false;
  let executed;
  try {
    executed = JSON.parse(fs.readFileSync(EXECUTED_PATH, 'utf8'));
  } catch (_) {
    return false;
  }
  if (!Array.isArray(executed) || executed.length === 0) return false;

  let getAccount;
  try {
    const aster = require('./aster-client.js');
    getAccount = aster.getAccount;
  } catch (_) {
    return false;
  }

  let account;
  try {
    account = await getAccount();
  } catch (e) {
    return false;
  }

  const positions = (account && account.positions) || [];
  const openSymbols = new Set();
  for (const p of positions) {
    const amt = parseFloat(p.positionAmt || '0');
    if (amt !== 0) openSymbols.add((p.symbol || '').toUpperCase());
  }

  const now = new Date().toISOString();
  let changed = false;
  for (const o of executed) {
    const symbol = (o.symbol || '').toUpperCase();
    if (!symbol || openSymbols.has(symbol)) continue;
    if (o.closed_on_aster === true) continue;
    o.closed_on_aster = true;
    if (o.closed_at == null) o.closed_at = now;
    changed = true;
  }

  if (changed) {
    const dir = path.dirname(EXECUTED_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EXECUTED_PATH, JSON.stringify(executed, null, 2), 'utf8');
    if (process.argv[1] && process.argv[1].includes('sync-executed-orders-with-aster')) {
      console.log('Sync ASTER → executed_orders :', executed.filter((e) => e.closed_on_aster).length, 'marqués fermés.');
    }
  }
  return true;
}

if (require.main === module) {
  runSync()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  module.exports = { runSync };
}
