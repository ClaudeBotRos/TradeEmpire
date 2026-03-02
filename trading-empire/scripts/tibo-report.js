#!/usr/bin/env node
/**
 * TradeEmpire — Rapport Tibo (agent executor/scrutator).
 * Agrège executed_orders, executor_pending_tp, executor_balance et écrit data/dashboard/tibo_report.json.
 * Appelé après executor-run.js (arg "executor") ou executor-tp-scrutator.js (arg "scrutator").
 * Lu par le BOSS et par Chase pour le post-mortem.
 * Usage: node scripts/tibo-report.js [executor|scrutator]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'dashboard', 'tibo_report.json');
const EXECUTED_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');
const PENDING_TP_PATH = path.join(ROOT, 'data', 'dashboard', 'executor_pending_tp.json');
const BALANCE_PATH = path.join(ROOT, 'data', 'dashboard', 'executor_balance.json');

function loadJson(p, def) {
  if (!fs.existsSync(p)) return def;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return def;
  }
}

function main() {
  const runType = (process.argv[2] || '').toLowerCase();
  const now = new Date().toISOString();

  const executed = loadJson(EXECUTED_PATH, []);
  const pendingTp = loadJson(PENDING_TP_PATH, []);
  const balance = loadJson(BALANCE_PATH, {});

  const today = now.slice(0, 10);
  const ordersToday = executed.filter((o) => (o.executed_at || '').startsWith(today));
  const withTp = executed.filter((o) => o.tp_order_id != null);
  const withoutTp = executed.filter((o) => o.tp_order_id == null && o.entry_order_id != null);

  let report = loadJson(REPORT_PATH, {});
  report.updated_at = now;
  report.agent = 'Tibo';
  report.balance_snapshot = {
    available_balance_usdt: balance.available_balance_usdt,
    total_wallet_balance_usdt: balance.total_wallet_balance_usdt,
    total_unrealized_profit_usdt: balance.total_unrealized_profit_usdt,
    updated_at: balance.updated_at,
  };
  report.executed_orders_count = executed.length;
  report.orders_today = ordersToday.length;
  report.orders_today_ids = ordersToday.map((o) => o.trade_id || o.entry_order_id).filter(Boolean);
  report.pending_tp_count = pendingTp.length;
  report.pending_tp_entries = pendingTp.map((p) => ({ entryOrderId: p.entryOrderId, symbol: p.symbol, trade_id: p.trade_id }));
  report.with_tp_placed = withTp.length;
  report.without_tp_yet = withoutTp.length;
  if (runType === 'executor') report.last_executor_run_at = now;
  if (runType === 'scrutator') report.last_scrutator_run_at = now;
  if (!report.last_executor_run_at && report.updated_at) report.last_executor_run_at = report.updated_at;
  if (!report.last_scrutator_run_at && report.updated_at) report.last_scrutator_run_at = report.updated_at;

  const dir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  if (runType) console.log('Tibo report updated (' + runType + ').');
}

main();
