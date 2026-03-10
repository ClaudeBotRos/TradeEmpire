#!/usr/bin/env node
/**
 * TradeEmpire — Mise en commun des données du trade pour passage d'ordres plus rapide.
 * Construit data/dashboard/execution_queue.json à partir des décisions APPROVED non encore exécutées.
 * L'exécuteur (executor-run.js) consomme cette queue pour placer les ordres sans recharger idées/décisions.
 * À lancer avant executor-run.js (ex. même cron : build puis executor).
 * Usage: node scripts/build-execution-queue.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'data', 'dashboard', 'execution_config.json');
const EXECUTED_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');
const DECISIONS_DIR = path.join(ROOT, 'data', 'decisions');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const QUEUE_PATH = path.join(ROOT, 'data', 'dashboard', 'execution_queue.json');
const RECOVERY_REPORT_PATH = path.join(ROOT, 'data', 'dashboard', 'recovery_report.json');
const RISK_RULES_PATH = path.join(ROOT, 'rules', 'risk_rules.md');

/** Charge recovery_report.json (Killian). Utilisé pour prioriser symboles sans perte récente. */
function loadRecoveryReport() {
  if (!fs.existsSync(RECOVERY_REPORT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(RECOVERY_REPORT_PATH, 'utf8'));
  } catch (_) {
    return null;
  }
}

/** Nombre de pertes pour un symbole dans le rapport recovery (0 si absent ou pas de loss). */
function getRecoveryLossCount(recovery, symbol) {
  if (!recovery || !recovery.by_symbol) return 0;
  const sym = String(symbol || '').toUpperCase();
  const stat = recovery.by_symbol[sym];
  return stat && typeof stat.loss === 'number' ? stat.loss : 0;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { real_mode: false, notional_usd: 5, notional_by_symbol: {}, max_trades_per_day: 5, default_leverage: 5, entry_price_refresh: false, tight_spread_pct: 0.2 };
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    let maxTrades = 5;
    if (typeof c.max_trades_per_day === 'number') maxTrades = c.max_trades_per_day;
    else if (fs.existsSync(RISK_RULES_PATH)) {
      const md = fs.readFileSync(RISK_RULES_PATH, 'utf8');
      const m = md.match(/Max trades par jour\s*:\s*(\d+)/i);
      if (m) maxTrades = Math.max(1, parseInt(m[1], 10));
    }
    const tightPct = typeof c.tight_spread_pct === 'number' ? Math.max(0.01, Math.min(2, c.tight_spread_pct)) : 0.2;
    return {
      real_mode: !!c.real_mode,
      notional_usd: c.notional_usd ?? 5,
      notional_by_symbol: c.notional_by_symbol || {},
      max_trades_per_day: maxTrades,
      default_leverage: typeof c.default_leverage === 'number' && c.default_leverage >= 1 ? c.default_leverage : 5,
      entry_price_refresh: c.entry_price_refresh === true,
      tight_spread_pct: tightPct,
    };
  } catch (_) {
    return { real_mode: false, notional_usd: 5, notional_by_symbol: {}, max_trades_per_day: 5, default_leverage: 5, entry_price_refresh: false, tight_spread_pct: 0.2 };
  }
}

function getMarginUsdForSymbol(config, symbol) {
  const sym = String(symbol || '').toUpperCase();
  const bySymbol = config.notional_by_symbol || {};
  if (typeof bySymbol[sym] === 'number' && bySymbol[sym] > 0) return bySymbol[sym];
  return typeof config.notional_usd === 'number' && config.notional_usd > 0 ? config.notional_usd : 5;
}

function loadExecuted() {
  if (!fs.existsSync(EXECUTED_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(EXECUTED_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function countExecutedToday(executedList) {
  const today = new Date().toISOString().slice(0, 10);
  return executedList.filter((e) => (e.executed_at || '').slice(0, 10) === today).length;
}

/** Ensemble "SYMBOL|BUY" et "SYMBOL|SELL" déjà exécutés aujourd'hui (max 1 ordre par sens et par paire par jour). */
function getExecutedTodaySymbolSides(executedList) {
  const today = new Date().toISOString().slice(0, 10);
  const set = new Set();
  for (const e of executedList) {
    if ((e.executed_at || '').slice(0, 10) !== today) continue;
    const side = e.side || (() => { const idea = loadIdea(e.trade_id); const d = (idea && idea.direction) || 'LONG'; return d === 'LONG' ? 'BUY' : 'SELL'; })();
    set.add(String(e.symbol || '').toUpperCase() + '|' + side);
  }
  return set;
}

function getRevokedTradeIds() {
  if (!fs.existsSync(DECISIONS_DIR)) return new Set();
  const files = fs.readdirSync(DECISIONS_DIR).filter((f) => f.endsWith('_REVOKED.json'));
  const ids = new Set();
  for (const f of files) {
    const m = f.match(/^(.+)_REVOKED\.json$/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function getApprovedDecisions() {
  if (!fs.existsSync(DECISIONS_DIR)) return [];
  const revokedIds = getRevokedTradeIds();
  const files = fs.readdirSync(DECISIONS_DIR).filter((f) => f.endsWith('_APPROVED.json'));
  const out = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DECISIONS_DIR, f), 'utf8'));
      if (data.status === 'APPROVED' && data.trade_id && !revokedIds.has(data.trade_id)) out.push(data);
    } catch (_) {}
  }
  return out;
}

function loadIdea(tradeId) {
  const p = path.join(IDEAS_DIR, `${tradeId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function roundQuantity(q, quantityPrecision, stepSize) {
  if (typeof stepSize === 'number' && stepSize > 0) {
    const steps = Math.round(Number(q) / stepSize) * stepSize;
    return parseFloat(steps.toPrecision(15));
  }
  const decimals = Math.max(0, parseInt(quantityPrecision, 10) || 3);
  return parseFloat(Number(q).toFixed(decimals));
}

function roundUpToStep(value, step) {
  if (!step || step <= 0) return value;
  const n = Math.ceil(Number(value) / step) * step;
  return parseFloat(n.toPrecision(15));
}

function roundPrice(p, pricePrecision) {
  const decimals = Math.max(0, parseInt(pricePrecision, 10) || 2);
  return parseFloat(Number(p).toFixed(decimals));
}

async function main() {
  const config = loadConfig();
  const executed = loadExecuted();
  const executedIds = new Set(executed.map((e) => e.trade_id));
  const executedToday = countExecutedToday(executed);
  const executedTodaySymbolSides = getExecutedTodaySymbolSides(executed);
  const maxPerDay = config.max_trades_per_day || 5;
  const slotsLeft = Math.max(0, maxPerDay - executedToday);

  let decisions = getApprovedDecisions().filter((d) => !executedIds.has(d.trade_id));
  decisions = decisions.filter((d) => {
    const idea = loadIdea(d.trade_id);
    if (!idea) return false;
    const sym = String(idea.symbol || '').toUpperCase();
    const side = (idea.direction || 'LONG') === 'LONG' ? 'BUY' : 'SELL';
    return !executedTodaySymbolSides.has(sym + '|' + side);
  });
  const recovery = loadRecoveryReport();
  decisions.sort((a, b) => {
    const ideaA = loadIdea(a.trade_id);
    const ideaB = loadIdea(b.trade_id);
    const lossA = getRecoveryLossCount(recovery, ideaA?.symbol);
    const lossB = getRecoveryLossCount(recovery, ideaB?.symbol);
    return lossA - lossB;
  });
  if (decisions.length > slotsLeft) decisions = decisions.slice(0, slotsLeft);

  if (!decisions.length) {
    const empty = { timestamp_utc: new Date().toISOString(), built_at: Date.now(), entries: [] };
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(empty, null, 2), 'utf8');
    console.log('Execution queue: 0 entries (aucune idée APPROVED à exécuter).');
    return;
  }

  let aster;
  try {
    aster = require('./aster-client.js');
  } catch (e) {
    console.error('aster-client indisponible:', e.message);
    process.exit(1);
  }

  const { getExchangeInfo, getSymbolPrecision } = aster;
  let exchangeInfo;
  try {
    exchangeInfo = await getExchangeInfo();
  } catch (e) {
    console.error('exchangeInfo:', e.message);
    process.exit(1);
  }

  const entries = [];
  const seenKey = new Set();

  const getMarkPrice = aster.getMarkPrice || (() => Promise.resolve(0));

  for (const dec of decisions) {
    const idea = loadIdea(dec.trade_id);
    if (!idea || !idea.entry?.price || !idea.invalid?.price || !idea.targets?.length) continue;

    const symbol = String(idea.symbol || '').toUpperCase();
    const direction = idea.direction || 'LONG';
    let entryPriceRaw = Number(idea.entry.price);
    if (config.entry_price_refresh && typeof getMarkPrice === 'function') {
      try {
        const mark = await getMarkPrice(symbol);
        if (mark > 0) {
          const pct = (config.tight_spread_pct ?? 0.2) / 100;
          const ideaEntry = entryPriceRaw;
          if (direction === 'LONG') {
            entryPriceRaw = Math.min(entryPriceRaw, mark * (1 - pct));
          } else {
            entryPriceRaw = Math.max(entryPriceRaw, mark * (1 + pct));
          }
          if (Math.abs(entryPriceRaw - ideaEntry) > 0.0001) {
            console.log('Entry price refresh ASTER:', symbol, direction, 'idea=', ideaEntry.toFixed(2), 'mark=', mark.toFixed(2), '->', entryPriceRaw.toFixed(2));
          }
        }
      } catch (_) {}
    }
    const dedupeKey = symbol + '|' + direction + '|' + entryPriceRaw.toFixed(2);
    if (seenKey.has(dedupeKey)) continue;
    seenKey.add(dedupeKey);

    const marginUsd = getMarginUsdForSymbol(config, symbol);
    const { quantityPrecision, pricePrecision, minQty, stepSize, minNotional } = getSymbolPrecision(exchangeInfo, symbol);
    const entryPrice = roundPrice(entryPriceRaw, pricePrecision);
    const invalidPrice = roundPrice(Number(idea.invalid.price), pricePrecision);
    const target1Price = roundPrice(Number(idea.targets[0].price), pricePrecision);
    const defaultLev = config.default_leverage || 5;
    const ideaLev = Number(idea.risk?.leverage);
    const leverage = Math.min(10, Math.max(1, Math.max(defaultLev, ideaLev || defaultLev)));
    let positionSizeUsd = Math.max(marginUsd * leverage, minNotional);
    let quantity = positionSizeUsd / entryPrice;
    quantity = roundQuantity(quantity, quantityPrecision, stepSize);
    const minQtyByNotional = stepSize > 0 && minNotional > 0 ? roundUpToStep(minNotional / entryPrice, stepSize) : 0;
    if (quantity < minQtyByNotional) quantity = minQtyByNotional;
    if (quantity <= 0) continue;
    const actualNotional = quantity * entryPrice;
    if (actualNotional < minNotional) continue;

    const isLong = direction === 'LONG';
    entries.push({
      trade_id: dec.trade_id,
      symbol,
      side: isLong ? 'BUY' : 'SELL',
      close_side: isLong ? 'SELL' : 'BUY',
      entry_price: entryPrice,
      invalid_price: invalidPrice,
      target_price: target1Price,
      leverage,
      quantity,
      margin_usd: actualNotional / leverage,
      notional_usd: actualNotional,
    });
  }

  const payload = {
    timestamp_utc: new Date().toISOString(),
    built_at: Date.now(),
    entries,
  };

  const dir = path.dirname(QUEUE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  const recoveryNote = recovery ? ' (tri selon recovery)' : '';
  console.log('Execution queue built:', entries.length, 'entry(ies)' + recoveryNote + '.', QUEUE_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
