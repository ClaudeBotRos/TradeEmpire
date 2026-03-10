#!/usr/bin/env node
/**
 * TradeEmpire — Exécution réelle (mode réel).
 * Lit execution_config.json : notional_usd / notional_by_symbol = MARGE en USD ; taille de position = marge × levier.
 * Pour chaque idée APPROVED non encore exécutée : ordre limite entrée, stop à invalid, TP au 1er objectif.
 * Usage: node scripts/executor-run.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'data', 'dashboard', 'execution_config.json');
const EXECUTED_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');
const PENDING_TP_PATH = path.join(ROOT, 'data', 'dashboard', 'executor_pending_tp.json');
const QUEUE_PATH = path.join(ROOT, 'data', 'dashboard', 'execution_queue.json');
const QUEUE_MAX_AGE_MS = 15 * 60 * 1000;
const RISK_RULES_PATH = path.join(ROOT, 'rules', 'risk_rules.md');
const DECISIONS_DIR = path.join(ROOT, 'data', 'decisions');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');

/** Arrondit la quantité au stepSize ou au nombre de décimales (évite erreur -1111 Precision). Retourne 0 si l'arrondi donne 0. */
function roundQuantity(q, quantityPrecision, stepSize) {
  if (typeof stepSize === 'number' && stepSize > 0) {
    const steps = Math.round(Number(q) / stepSize) * stepSize;
    return parseFloat(steps.toPrecision(15));
  }
  const decimals = Math.max(0, parseInt(quantityPrecision, 10) || 3);
  return parseFloat(Number(q).toFixed(decimals));
}

/** Arrondir au step par excès (comme DTO) pour garantir notional >= minNotional. */
function roundUpToStep(value, step) {
  if (!step || step <= 0) return value;
  const n = Math.ceil(Number(value) / step) * step;
  return parseFloat(n.toPrecision(15));
}

/** Arrondit le prix au nombre de décimales autorisé. */
function roundPrice(p, pricePrecision) {
  const decimals = Math.max(0, parseInt(pricePrecision, 10) || 2);
  return parseFloat(Number(p).toFixed(decimals));
}

/** Lit max trades par jour depuis execution_config ou risk_rules.md (défaut 5). */
function getMaxTradesPerDay(configFromFile) {
  if (typeof configFromFile.max_trades_per_day === 'number' && configFromFile.max_trades_per_day > 0) return configFromFile.max_trades_per_day;
  if (fs.existsSync(RISK_RULES_PATH)) {
    try {
      const md = fs.readFileSync(RISK_RULES_PATH, 'utf8');
      const m = md.match(/Max trades par jour\s*:\s*(\d+)/i);
      if (m) return Math.max(1, parseInt(m[1], 10));
    } catch (_) {}
  }
  return 5;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { real_mode: false, notional_usd: 5, notional_by_symbol: {}, max_trades_per_day: 5, default_leverage: 5, entry_price_refresh: false, tight_spread_pct: 0.2 };
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const maxTrades = getMaxTradesPerDay(c);
    const defaultLeverage = typeof c.default_leverage === 'number' && c.default_leverage >= 1 ? c.default_leverage : 5;
    const tightPct = typeof c.tight_spread_pct === 'number' ? Math.max(0.01, Math.min(2, c.tight_spread_pct)) : 0.2;
    return {
      real_mode: !!c.real_mode,
      notional_usd: c.notional_usd ?? 5,
      notional_by_symbol: c.notional_by_symbol || {},
      max_trades_per_day: maxTrades,
      default_leverage: defaultLeverage,
      entry_price_refresh: c.entry_price_refresh === true,
      tight_spread_pct: tightPct,
    };
  } catch (_) {
    return { real_mode: false, notional_usd: 5, notional_by_symbol: {}, max_trades_per_day: 5, default_leverage: 5, entry_price_refresh: false, tight_spread_pct: 0.2 };
  }
}

/** Marge en USD pour un symbole (config : notional_usd / notional_by_symbol = marge ; la taille de position = marge × levier). */
function getMarginUsdForSymbol(config, symbol) {
  const sym = String(symbol || '').toUpperCase();
  const bySymbol = config.notional_by_symbol || {};
  if (typeof bySymbol[sym] === 'number' && bySymbol[sym] > 0) return bySymbol[sym];
  const defaultMargin = typeof config.notional_usd === 'number' && config.notional_usd > 0 ? config.notional_usd : 5;
  return defaultMargin;
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

/** Nombre d'ordres déjà exécutés aujourd'hui (date locale ou UTC selon executed_at). */
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

function saveExecuted(list) {
  const dir = path.dirname(EXECUTED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EXECUTED_PATH, JSON.stringify(list, null, 2), 'utf8');
}

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

function loadExecutionQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
    if (!Array.isArray(data.entries) || !data.entries.length) return null;
    const age = Date.now() - (data.built_at || 0);
    if (age > QUEUE_MAX_AGE_MS) return null;
    return data;
  } catch (_) {
    return null;
  }
}

async function main() {
  const config = loadConfig();
  if (!config.real_mode) {
    console.log('Mode réel désactivé. Activer depuis le dashboard (Exécution).');
    return;
  }

  let aster;
  try {
    aster = require('./aster-client.js');
  } catch (e) {
    console.error('aster-client.js indisponible:', e.message);
    process.exit(1);
  }

  const { getAccount, setLeverage, placeOrder, placeStopMarketOrder, placeMarketOrder } = aster;

  const balancePath = path.join(ROOT, 'data', 'dashboard', 'executor_balance.json');
  try {
    const account = await getAccount();
    const available = parseFloat(account.availableBalance || 0);
    const total = parseFloat(account.totalWalletBalance || 0);
    const unrealized = parseFloat(account.totalUnrealizedProfit || 0);
    const balancePayload = {
      available_balance_usdt: available,
      total_wallet_balance_usdt: total,
      total_unrealized_profit_usdt: unrealized,
      positions_count: (account.positions || []).filter((p) => Math.abs(parseFloat(p.positionAmt || 0)) > 0).length,
      updated_at: new Date().toISOString(),
    };
    const balanceDir = path.dirname(balancePath);
    if (!fs.existsSync(balanceDir)) fs.mkdirSync(balanceDir, { recursive: true });
    fs.writeFileSync(balancePath, JSON.stringify(balancePayload, null, 2), 'utf8');
    console.log('Solde ASTER — disponible:', available.toFixed(2), 'USDT | wallet total:', total.toFixed(2), 'USDT | PnL non réalisé:', unrealized.toFixed(2), 'USDT');
  } catch (e) {
    console.log('Solde ASTER non récupéré:', e.message);
  }

  const executed = loadExecuted();
  const executedIds = new Set(executed.map((e) => e.trade_id));
  const executedToday = countExecutedToday(executed);
  const executedTodaySymbolSides = getExecutedTodaySymbolSides(executed);
  const maxPerDay = config.max_trades_per_day || 5;
  if (executedToday >= maxPerDay) {
    console.log('Limite du jour atteinte :', executedToday, '/', maxPerDay, 'ordres. Relance demain ou ajuster max_trades_per_day.');
    const { spawnSync } = require('child_process');
    spawnSync(process.execPath, [path.join(__dirname, 'tibo-report.js'), 'executor'], { cwd: ROOT, stdio: 'inherit', env: process.env });
    return;
  }

  const now = new Date().toISOString();
  const queue = loadExecutionQueue();
  let entriesToRun = [];

  if (queue && queue.entries && queue.entries.length > 0) {
    entriesToRun = queue.entries
      .filter((e) => !executedIds.has(e.trade_id))
      .filter((e) => !executedTodaySymbolSides.has((e.symbol || '').toUpperCase() + '|' + (e.side || 'BUY')))
      .slice(0, maxPerDay - executedToday);
    if (entriesToRun.length > 0) {
      console.log('Exécution depuis la queue (mise en commun des données) —', entriesToRun.length, 'trade(s).');
    }
  }

  if (entriesToRun.length === 0) {
    const decisions = getApprovedDecisions().filter((d) => !executedIds.has(d.trade_id));
    const slotsLeft = maxPerDay - executedToday;
    let decisionsFiltered = decisions.filter((d) => {
      const idea = loadIdea(d.trade_id);
      if (!idea) return false;
      const sym = String(idea.symbol || '').toUpperCase();
      const side = (idea.direction || 'LONG') === 'LONG' ? 'BUY' : 'SELL';
      return !executedTodaySymbolSides.has(sym + '|' + side);
    });
    let decisionsSlice = decisionsFiltered.length > slotsLeft ? decisionsFiltered.slice(0, slotsLeft) : decisionsFiltered;
    if (!decisionsSlice.length) {
      console.log('Aucune idée APPROVED à exécuter.');
      try {
        const { spawnSync } = require('child_process');
        spawnSync(process.execPath, [path.join(__dirname, 'tibo-report.js'), 'executor'], { cwd: ROOT, stdio: 'inherit', env: process.env });
      } catch (_) {}
      return;
    }
    const { getExchangeInfo, getSymbolPrecision, getMarkPrice } = aster;
    let exchangeInfo;
    try {
      exchangeInfo = await getExchangeInfo();
    } catch (e) {
      console.error('Impossible de récupérer exchangeInfo (précisions):', e.message);
      process.exit(1);
    }
    const seenKey = new Set();
    for (const dec of decisionsSlice) {
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
            if (direction === 'LONG') entryPriceRaw = Math.min(entryPriceRaw, mark * (1 - pct));
            else entryPriceRaw = Math.max(entryPriceRaw, mark * (1 + pct));
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
      const minQtyByNotional = (stepSize > 0 && minNotional > 0) ? roundUpToStep(minNotional / entryPrice, stepSize) : 0;
      if (quantity < minQtyByNotional) quantity = minQtyByNotional;
      if (quantity <= 0) continue;
      const actualNotional = quantity * entryPrice;
      if (actualNotional < minNotional) continue;
      const isLong = direction === 'LONG';
      entriesToRun.push({
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
  }

  for (const ent of entriesToRun) {
    const { trade_id, symbol, side, close_side, entry_price, invalid_price, target_price, leverage, quantity, margin_usd, notional_usd } = ent;
    console.log(symbol, 'lev', leverage, 'qty', quantity, 'notional', notional_usd.toFixed(2), 'USDT marge ~', margin_usd.toFixed(2));
    try {
      await setLeverage(symbol, leverage).catch((e) => console.warn('setLeverage', symbol, e.message));
      let entryOrder = null;
      try {
        entryOrder = await placeStopMarketOrder({
          symbol,
          side,
          quantity,
          stopPrice: entry_price,
        });
      } catch (entryErr) {
        if (/immediately trigger|would immediately/i.test(entryErr.message)) {
          try {
            entryOrder = await placeOrder({
              symbol,
              side,
              type: 'LIMIT',
              quantity,
              price: entry_price,
            });
          } catch (limitErr) {
            if (/tick size|precision|not increased|price.*tick/i.test(limitErr.message)) {
              entryOrder = await placeMarketOrder({ symbol, side, quantity });
              console.log(symbol, 'entrée au market (tick size invalide pour limit).');
            } else throw limitErr;
          }
        } else if (/tick size|precision|not increased|price.*tick/i.test(entryErr.message)) {
          entryOrder = await placeMarketOrder({ symbol, side, quantity });
          console.log(symbol, 'entrée au market (tick size invalide pour stop).');
        } else throw entryErr;
      }
      const slOrder = await placeStopMarketOrder({
        symbol,
        side: close_side,
        quantity,
        stopPrice: invalid_price,
      });

      const entryId = entryOrder?.orderId ?? entryOrder?.orderid;
      if (entryId != null) {
        const pendingTp = loadPendingTp();
        pendingTp.push({
          entryOrderId: entryId,
          symbol,
          side: side === 'BUY' ? 'long' : 'short',
          quantity: String(quantity),
          takeProfitPrice: target_price,
          trade_id,
        });
        savePendingTp(pendingTp);
      }

      executed.push({
        trade_id,
        symbol,
        side,
        executed_at: now,
        entry_order_id: entryId ?? null,
        sl_order_id: slOrder?.orderId ?? slOrder?.orderid ?? null,
        tp_order_id: null,
        margin_usd,
        leverage,
        position_size_usd: notional_usd,
        quantity,
      });
      saveExecuted(executed);
      console.log('OK', trade_id, symbol, side, 'marge', margin_usd, '$ ×', leverage, '=', notional_usd.toFixed(0), '$ qty', quantity, 'entry', entryId ?? '—', 'SL', slOrder?.orderId ?? '—', 'TP (scrutator)');
    } catch (e) {
      console.error('Erreur', trade_id, e.message);
    }
  }
}

main()
  .then(async () => {
    try {
      await require('./sync-executed-orders-with-aster.js').runSync();
    } catch (_) {}
    try {
      require('child_process').execSync(
        `node "${path.join(__dirname, 'tibo-report.js')}" executor`,
        { cwd: ROOT, stdio: 'ignore' }
      );
    } catch (_) {}
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
