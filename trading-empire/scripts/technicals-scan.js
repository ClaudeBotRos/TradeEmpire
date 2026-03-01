#!/usr/bin/env node
/**
 * TradeEmpire — Scan technique : récupère OHLCV Binance, calcule trend/levels/volatility,
 * écrit data/signals/technicals/{symbol}_{tf}_{timestamp}.json
 * Usage: node technicals-scan.js [SYMBOL] [INTERVAL]
 * Default: BTCUSDT 4h
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SYMBOL = process.argv[2] || 'BTCUSDT';
const TF = process.argv[3] || '4h';
const BINANCE_INTERVAL = TF === '1D' ? '1d' : TF.toLowerCase();

function fetchOHLCV() {
  const out = execSync(
    `node "${path.join(__dirname, 'fetch-ohlcv.js')}" "${SYMBOL}" "${BINANCE_INTERVAL}" 100`,
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

function main() {
  const candles = fetchOHLCV();
  if (!candles.length) {
    console.error('No candles received');
    process.exit(1);
  }

  const trend = computeTrend(candles);
  const levels = computeLevels(candles);
  const volatility = computeVolatility(candles);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const timestampUtc = now.toISOString();

  const signal = {
    timestamp_utc: timestampUtc,
    symbol: SYMBOL,
    timeframe: TF,
    trend,
    levels,
    volatility: Math.round(volatility * 1e6) / 1e6,
    setup_candidates: [],
    sources: [{ type: 'exchange', ref: 'binance_klines_' + BINANCE_INTERVAL }],
  };

  const outDir = path.join(ROOT, 'data', 'signals', 'technicals');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const filename = `${SYMBOL}_${TF}_${timestamp}.json`;
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(signal, null, 2), 'utf8');

  console.log('OK', filepath);
}

main();
