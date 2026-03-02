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
  if (!fs.existsSync(CONFIG_PATH)) return { real_mode: false, notional_usd: 5, notional_by_symbol: {}, max_trades_per_day: 5, default_leverage: 5 };
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const maxTrades = getMaxTradesPerDay(c);
    const defaultLeverage = typeof c.default_leverage === 'number' && c.default_leverage >= 1 ? c.default_leverage : 5;
    return {
      real_mode: !!c.real_mode,
      notional_usd: c.notional_usd ?? 5,
      notional_by_symbol: c.notional_by_symbol || {},
      max_trades_per_day: maxTrades,
      default_leverage: defaultLeverage,
    };
  } catch (_) {
    return { real_mode: false, notional_usd: 5, notional_by_symbol: {}, max_trades_per_day: 5, default_leverage: 5 };
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

function getApprovedDecisions() {
  if (!fs.existsSync(DECISIONS_DIR)) return [];
  const files = fs.readdirSync(DECISIONS_DIR).filter((f) => f.endsWith('_APPROVED.json'));
  const out = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DECISIONS_DIR, f), 'utf8'));
      if (data.status === 'APPROVED' && data.trade_id) out.push(data);
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

async function main() {
  const config = loadConfig();
  if (!config.real_mode) {
    console.log('Mode réel désactivé. Activer depuis le dashboard (Exécution).');
    return;
  }

  const executed = loadExecuted();
  const executedIds = new Set(executed.map((e) => e.trade_id));
  const executedToday = countExecutedToday(executed);
  const maxPerDay = config.max_trades_per_day || 5;
  if (executedToday >= maxPerDay) {
    console.log('Limite du jour atteinte :', executedToday, '/', maxPerDay, 'ordres. Relance demain ou ajuster max_trades_per_day.');
    return;
  }

  let decisions = getApprovedDecisions().filter((d) => !executedIds.has(d.trade_id));
  const slotsLeft = maxPerDay - executedToday;
  if (decisions.length > slotsLeft) {
    console.log('Limite du jour :', maxPerDay, '- exécutés aujourd\'hui :', executedToday, '→ on place au plus', slotsLeft, 'ordre(s).');
    decisions = decisions.slice(0, slotsLeft);
  }
  if (!decisions.length) {
    console.log('Aucune idée APPROVED à exécuter.');
    return;
  }

  let aster;
  try {
    aster = require('./aster-client.js');
  } catch (e) {
    console.error('aster-client.js indisponible:', e.message);
    process.exit(1);
  }

  const { getAccount, getLeverage, setLeverage, placeOrder, placeStopMarketOrder, placeTakeProfitOrder, getMarkPrice, getExchangeInfo, getSymbolPrecision } = aster;

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

  let exchangeInfo;
  try {
    exchangeInfo = await getExchangeInfo();
  } catch (e) {
    console.error('Impossible de récupérer exchangeInfo (précisions):', e.message);
    process.exit(1);
  }
  const now = new Date().toISOString();
  const seenKey = new Set();

  for (const dec of decisions) {
    const idea = loadIdea(dec.trade_id);
    if (!idea || !idea.entry?.price || !idea.invalid?.price || !idea.targets?.length) {
      console.log('Skip', dec.trade_id, '(idée invalide ou champs manquants)');
      continue;
    }

    const symbol = String(idea.symbol || '').toUpperCase();
    const direction = idea.direction || 'LONG';
    const entryPriceRaw = Number(idea.entry.price);
    const dedupeKey = symbol + '|' + direction + '|' + entryPriceRaw.toFixed(2);
    if (seenKey.has(dedupeKey)) {
      console.log('Skip', dec.trade_id, symbol, '(même symbole, direction et prix qu\'une idée déjà traitée)');
      continue;
    }
    seenKey.add(dedupeKey);
    const marginUsd = getMarginUsdForSymbol(config, symbol);
    const { quantityPrecision, pricePrecision, minQty, stepSize, minNotional } = getSymbolPrecision(exchangeInfo, symbol);
    const entryPrice = roundPrice(Number(idea.entry.price), pricePrecision);
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
    if (quantity <= 0) {
      console.log('Skip', dec.trade_id, symbol, '(quantité nulle après arrondi)');
      continue;
    }
    const actualNotional = quantity * entryPrice;
    if (actualNotional < minNotional) {
      console.log('Skip', dec.trade_id, symbol, '(notional après arrondi', actualNotional.toFixed(2), '$ <', minNotional, '$)');
      continue;
    }
    const marginRequired = actualNotional / leverage;
    console.log(symbol, 'lev', leverage, 'qty', quantity, 'notional', actualNotional.toFixed(2), 'USDT marge ~', marginRequired.toFixed(2));

    const isLong = idea.direction === 'LONG';
    const side = isLong ? 'BUY' : 'SELL';
    const closeSide = isLong ? 'SELL' : 'BUY';

    try {
      await setLeverage(symbol, leverage).catch((e) => console.warn('setLeverage', symbol, e.message));
      let entryOrder = null;
      try {
        entryOrder = await placeStopMarketOrder({
          symbol,
          side,
          quantity,
          stopPrice: entryPrice,
        });
      } catch (entryErr) {
        if (/immediately trigger|would immediately/i.test(entryErr.message)) {
          entryOrder = await placeOrder({
            symbol,
            side,
            type: 'LIMIT',
            quantity,
            price: entryPrice,
          });
        } else throw entryErr;
      }
      const slOrder = await placeStopMarketOrder({
        symbol,
        side: closeSide,
        quantity,
        stopPrice: invalidPrice,
      });

      const entryId = entryOrder?.orderId ?? entryOrder?.orderid;
      if (entryId != null) {
        const pendingTp = loadPendingTp();
        pendingTp.push({
          entryOrderId: entryId,
          symbol,
          side: isLong ? 'long' : 'short',
          quantity: String(quantity),
          takeProfitPrice: target1Price,
          trade_id: dec.trade_id,
        });
        savePendingTp(pendingTp);
      }

      executed.push({
        trade_id: dec.trade_id,
        symbol,
        executed_at: now,
        entry_order_id: entryId ?? null,
        sl_order_id: slOrder?.orderId ?? slOrder?.orderid ?? null,
        tp_order_id: null,
        margin_usd: marginUsd,
        leverage,
        position_size_usd: positionSizeUsd,
        quantity,
      });
      saveExecuted(executed);
      console.log('OK', dec.trade_id, symbol, side, 'marge', marginUsd, '$ ×', leverage, '=', positionSizeUsd, '$ qty', quantity, 'entry', entryId ?? '—', 'SL', slOrder?.orderId ?? '—', 'TP (scrutator)');
    } catch (e) {
      console.error('Erreur', dec.trade_id, e.message);
    }
  }
}

main()
  .then(() => {
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
