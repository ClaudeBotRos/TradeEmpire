#!/usr/bin/env node
/**
 * TradeEmpire — Alicia (Technicals) : indicateurs crypto via RapidAPI (RSI, MACD, EMA).
 * API: Crypto Trading Indicators (crypto-technical-analysis-indicator-apis-for-trading.p.rapidapi.com).
 * Utilise RAPIDAPI_KEY (workspace/.env). Symboles = watchlist.
 * Sortie: data/signals/technicals/crypto_indicators_rapidapi.json
 * Usage: node scripts/crypto-indicators-rapidapi.js [SYMBOL1] [SYMBOL2] ...
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WATCHLIST_PATH = path.join(ROOT, 'data', 'dashboard', 'watchlist.json');
const OUT_DIR = path.join(ROOT, 'data', 'signals', 'technicals');
const OUT_PATH = path.join(OUT_DIR, 'crypto_indicators_rapidapi.json');

const HOST = 'crypto-technical-analysis-indicator-apis-for-trading.p.rapidapi.com';
const DEFAULT_TIMEFRAME = '4h';

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

async function fetchIndicator(apiKey, endpoint, params) {
  const q = new URLSearchParams(params).toString();
  const url = `https://${HOST}${endpoint}?${q}`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'x-rapidapi-host': HOST,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function latest(arr) {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

async function fetchIndicatorsForSymbol(apiKey, symbol, timeframe = DEFAULT_TIMEFRAME) {
  const common = { symbol, timeframe };
  const [rsiRes, macdRes, emaRes] = await Promise.all([
    fetchIndicator(apiKey, '/rsi', { ...common, length: 14 }),
    fetchIndicator(apiKey, '/macd', common),
    fetchIndicator(apiKey, '/ema', { ...common, length: 20 }),
  ]);
  const rsiRow = latest(rsiRes.rsi);
  const macdRow = latest(macdRes.macd);
  const emaRow = latest(emaRes.ema);
  return {
    rsi: rsiRow ? rsiRow.rsi : null,
    rsi_close: rsiRow ? rsiRow.close : null,
    macd: macdRow ? macdRow.macd : null,
    macd_signal: macdRow ? macdRow.signal : null,
    macd_histogram: macdRow ? macdRow.histogram : null,
    macd_close: macdRow ? macdRow.close : null,
    ema: emaRow ? emaRow.ema : null,
    ema_close: emaRow ? emaRow.close : null,
    timeframe,
    timestamp_utc: (rsiRow && rsiRow.time) ? new Date(rsiRow.time).toISOString() : null,
  };
}

async function main() {
  const apiKey = (process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '').trim();
  if (!apiKey) {
    console.error('RAPIDAPI_KEY (ou X_RAPIDAPI_KEY) manquant dans .env');
    process.exit(1);
  }

  const symbolsFromArgs = process.argv.slice(2).filter(Boolean).map((s) => String(s).toUpperCase());
  const symbols = symbolsFromArgs.length ? symbolsFromArgs : loadWatchlist();
  console.log('Crypto indicators (RapidAPI):', symbols.length, 'symbol(s)', symbols.join(', '));

  const by_symbol = {};
  const errors = [];

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 800));
    try {
      const data = await fetchIndicatorsForSymbol(apiKey, symbol);
      by_symbol[symbol] = data;
      console.log('OK', symbol, 'RSI', data.rsi != null ? data.rsi.toFixed(2) : '—', 'MACD', data.macd != null ? data.macd.toFixed(2) : '—', 'EMA', data.ema != null ? data.ema.toFixed(2) : '—');
    } catch (e) {
      console.error('Skip', symbol, e.message || e);
      errors.push({ symbol, error: (e.message || String(e)).slice(0, 200) });
      by_symbol[symbol] = null;
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const payload = {
    last_updated_utc: new Date().toISOString(),
    source: HOST,
    timeframe: DEFAULT_TIMEFRAME,
    by_symbol,
    errors: errors.length ? errors : undefined,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log('OK', OUT_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
