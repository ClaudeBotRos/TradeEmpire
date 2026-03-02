#!/usr/bin/env node
/**
 * TradeEmpire — Scan technique : récupère OHLCV Binance, calcule trend/levels/volatility,
 * écrit data/signals/technicals/{symbol}_{tf}_{timestamp}.json
 * Usage: node technicals-scan.js [SYMBOL] [INTERVAL]
 *   Sans args : charge la watchlist (data/dashboard/watchlist.json) et scanne toutes les symboles (BTC, ETH, alts).
 *   Avec SYMBOL : scanne uniquement ce symbole (comportement legacy).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const WATCHLIST_PATH = path.join(ROOT, 'data', 'dashboard', 'watchlist.json');
const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_PATH)) return DEFAULT_SYMBOLS;
  try {
    const data = JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
    const symbols = Array.isArray(data.symbols) ? data.symbols : DEFAULT_SYMBOLS;
    return symbols.filter((s) => s && String(s).toUpperCase() === s);
  } catch (_) {
    return DEFAULT_SYMBOLS;
  }
}

function fetchOHLCV(symbol, binanceInterval) {
  const out = execSync(
    `node "${path.join(__dirname, 'fetch-ohlcv.js')}" "${symbol}" "${binanceInterval}" 100`,
    { encoding: 'utf8', cwd: ROOT }
  );
  return JSON.parse(out);
}

function computeTrend(candles) {
  if (!candles.length) return 'range';
  const closes = candles.map((c) => c.close);
  const third = Math.max(1, Math.floor(closes.length / 3));
  const first = closes.slice(0, third).reduce((a, b) => a + b, 0) / third;
  const last = closes.slice(-third).reduce((a, b) => a + b, 0) / third;
  const change = first === 0 ? 0 : (last - first) / first;
  if (change > 0.02) return 'up';
  if (change < -0.02) return 'down';
  return 'range';
}

function computeLevels(candles, n = 10) {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const resistance = [];
  const support = [];
  for (let i = 1; i < candles.length - 1; i++) {
    if (highs[i] >= Math.max(...highs.slice(Math.max(0, i - n), i + n + 1))) {
      resistance.push(highs[i]);
    }
    if (lows[i] <= Math.min(...lows.slice(Math.max(0, i - n), i + n + 1))) {
      support.push(lows[i]);
    }
  }
  const uniq = (arr) => [...new Set(arr)].sort((a, b) => a - b);
  return {
    support: uniq(support).slice(-5),
    resistance: uniq(resistance).slice(-5),
  };
}

function computeVolatility(candles) {
  const closes = candles.map((c) => c.close);
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((a, c) => a + (c - mean) ** 2, 0) / closes.length;
  return Math.sqrt(variance);
}

function runForSymbol(symbol, tf, binanceInterval) {
  let candles;
  try {
    candles = fetchOHLCV(symbol, binanceInterval);
  } catch (e) {
    console.error('Skip', symbol, e.message || e);
    return;
  }
  if (!candles.length) {
    console.error('Skip', symbol, '(no candles)');
    return;
  }

  const trend = computeTrend(candles);
  const levels = computeLevels(candles);
  const volatility = computeVolatility(candles);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const timestampUtc = now.toISOString();

  const signal = {
    timestamp_utc: timestampUtc,
    symbol,
    timeframe: tf,
    trend,
    levels,
    volatility: Math.round(volatility * 1e6) / 1e6,
    setup_candidates: [],
    sources: [{ type: 'exchange', ref: 'binance_klines_' + binanceInterval }],
  };

  const outDir = path.join(ROOT, 'data', 'signals', 'technicals');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const filename = `${symbol}_${tf}_${timestamp}.json`;
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(signal, null, 2), 'utf8');
  console.log('OK', symbol, filepath);
}

function main() {
  const singleSymbol = process.argv[2];
  const tf = process.argv[3] || '4h';
  const binanceInterval = tf === '1D' ? '1d' : tf.toLowerCase();

  const symbols = singleSymbol ? [String(singleSymbol).toUpperCase()] : loadWatchlist();
  console.log('Technicals scan:', symbols.length, 'symbol(s)', symbols.join(', '));

  for (const symbol of symbols) {
    runForSymbol(symbol, tf, binanceInterval);
  }
}

main();
