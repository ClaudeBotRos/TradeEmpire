#!/usr/bin/env node
/**
 * TradeEmpire — Construit le contexte pour l’analyse Recovery (agent).
 * Ordres ouverts ASTER + technicals (tendance) + Scout + Chase.
 * Écrit data/dashboard/recovery_intraday_context.json pour que l’agent l’analyse.
 * Usage: node scripts/recovery-intraday-context.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');
const {
  getRecentLossSymbols,
  getRecentTargetOrWinSymbols,
  loadChaseFeedbackJson,
} = require('./chase-feedback-loader.js');

const ROOT = path.join(__dirname, '..');
const TECHNICALS_DIR = path.join(ROOT, 'data', 'signals', 'technicals');
const SCOUT_PATH = path.join(ROOT, 'data', 'dashboard', 'scout_proposals.json');
const CONTEXT_PATH = path.join(ROOT, 'data', 'dashboard', 'recovery_intraday_context.json');
const WATCHLIST_PATH = path.join(ROOT, 'data', 'dashboard', 'watchlist.json');

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_PATH)) return [];
  try {
    const d = JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
    return Array.isArray(d.symbols) ? d.symbols : [];
  } catch (_) {
    return [];
  }
}

function loadLatestTechnicalsBySymbol() {
  if (!fs.existsSync(TECHNICALS_DIR)) return {};
  const byKey = {};
  const files = fs.readdirSync(TECHNICALS_DIR).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(TECHNICALS_DIR, f), 'utf8'));
      const key = `${(data.symbol || '').toUpperCase()}_${data.timeframe || '4h'}`;
      const ts = (data.timestamp_utc || '').replace(/[-:T.Z]/g, '');
      if (!byKey[key] || (ts && (!byKey[key].timestamp_utc || ts > (byKey[key].timestamp_utc || '').replace(/[-:T.Z]/g, '')))) {
        byKey[key] = data;
      }
    } catch (_) {}
  }
  return byKey;
}

function isEntryOrder(order) {
  const type = (order.type || '').toUpperCase();
  const stopPrice = String(order.stopPrice ?? '').trim();
  return type === 'LIMIT' && (!stopPrice || stopPrice === '0' || stopPrice === '0.0');
}

async function main() {
  let aster;
  try {
    aster = require('./aster-client.js');
  } catch (e) {
    console.error('ASTER indisponible:', e.message);
    process.exit(1);
  }

  let allOpen = [];
  try {
    allOpen = await aster.getOpenOrders();
  } catch (e) {
    if (e.message && e.message.includes('symbol')) {
      const wl = loadWatchlist().length ? loadWatchlist() : ['BTCUSDT', 'ETHUSDT'];
      for (const sym of wl) {
        try {
          const list = await aster.getOpenOrders(sym);
          allOpen = allOpen.concat(list);
        } catch (_) {}
      }
    } else {
      console.error('getOpenOrders:', e.message);
      process.exit(1);
    }
  }

  const entryOrders = allOpen.filter(isEntryOrder);
  const technicalsByKey = loadLatestTechnicalsBySymbol();

  const open_orders = entryOrders.map((o) => ({
    orderId: o.orderId,
    symbol: (o.symbol || '').toUpperCase(),
    side: (o.side || '').toUpperCase(),
    price: o.price,
    origQty: o.origQty,
    type: o.type || 'LIMIT',
  }));

  const technicals_for_orders = {};
  for (const o of open_orders) {
    const key = `${o.symbol}_4h`;
    const tech = technicalsByKey[key];
    if (tech) {
      technicals_for_orders[o.symbol] = {
        trend: tech.trend || null,
        levels: tech.levels || null,
        timestamp_utc: tech.timestamp_utc || null,
      };
    }
  }

  let scout_summary = null;
  let scout_proposals_for_symbols = [];
  if (fs.existsSync(SCOUT_PATH)) {
    try {
      const scout = JSON.parse(fs.readFileSync(SCOUT_PATH, 'utf8'));
      scout_summary = scout.summary || null;
      const orderSymbols = new Set(open_orders.map((o) => o.symbol));
      if (scout.proposals && Array.isArray(scout.proposals)) {
        scout_proposals_for_symbols = scout.proposals.filter((p) =>
          orderSymbols.has((p.symbol || '').toUpperCase())
        );
      }
    } catch (_) {}
  }

  const chaseJson = loadChaseFeedbackJson();
  const chase_summary =
    chaseJson && chaseJson.by_agent && chaseJson.by_agent.ORCHESTRATOR
      ? chaseJson.by_agent.ORCHESTRATOR
      : chaseJson && chaseJson.by_agent
        ? Object.values(chaseJson.by_agent).join(' ')
        : null;
  const chase_recent_loss_symbols = getRecentLossSymbols();
  const chase_recent_win_symbols = getRecentTargetOrWinSymbols();

  const context = {
    timestamp_utc: new Date().toISOString(),
    open_orders,
    technicals_by_symbol: technicals_for_orders,
    scout_summary,
    scout_proposals_relevant: scout_proposals_for_symbols,
    chase_summary,
    chase_recent_loss_symbols,
    chase_recent_win_symbols,
    instruction:
      'Pour chaque ordre dans open_orders, décide action (keep ou cancel) et reason. Tiens compte de : trend (technicals_by_symbol), Scout (scout_summary), Chase (chase_summary, chase_recent_loss_symbols). Écris le résultat dans data/dashboard/recovery_agent_recommendations.json avec format { "timestamp_utc": "...", "recommendations": [ { "orderId", "symbol", "action": "keep"|"cancel", "reason": "..." } ] }.',
  };

  const dir = path.dirname(CONTEXT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONTEXT_PATH, JSON.stringify(context, null, 2), 'utf8');
  console.log('Context written to', CONTEXT_PATH, '| orders:', open_orders.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
