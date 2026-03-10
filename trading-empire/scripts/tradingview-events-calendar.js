#!/usr/bin/env node
/**
 * TradeEmpire — Alicia (Technicals) : calendrier d’événements par symbole (TradingView via RapidAPI).
 * Endpoint: GET https://tradingview18.p.rapidapi.com/symbols/get-events-calendar?symbol=XXX
 * Utilise RAPIDAPI_KEY (workspace/.env). Symboles = watchlist (BTCUSDT, ETHUSDT, etc.).
 * Pour les crypto Binance, l’API accepte souvent le symbole tel quel ou avec préfixe BINANCE:.
 * Sortie: data/signals/technicals/tradingview_events_calendar.json
 * Usage: node scripts/tradingview-events-calendar.js [SYMBOL1] [SYMBOL2] ...
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WATCHLIST_PATH = path.join(ROOT, 'data', 'dashboard', 'watchlist.json');
const OUT_DIR = path.join(ROOT, 'data', 'signals', 'technicals');
const OUT_PATH = path.join(OUT_DIR, 'tradingview_events_calendar.json');

const RAPIDAPI_HOST = 'tradingview18.p.rapidapi.com';

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

/**
 * TradingView peut attendre un format type BINANCE:BTCUSDT pour le crypto.
 * On essaie d’abord le symbole tel quel, puis avec le préfixe BINANCE: si besoin.
 */
function toTradingViewSymbol(symbol) {
  const s = String(symbol).toUpperCase();
  if (/^[A-Z0-9]+USDT$/.test(s)) return s;
  return s;
}

async function fetchEventsForSymbol(apiKey, symbol) {
  const q = encodeURIComponent(toTradingViewSymbol(symbol));
  const url = `https://${RAPIDAPI_HOST}/symbols/get-events-calendar?symbol=${q}`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  // TradingView 18 API: events are in finance.result.mixedEvents[].records
  const finance = data.finance && data.finance.result;
  if (finance && Array.isArray(finance.mixedEvents)) {
    const list = [];
    for (const group of finance.mixedEvents) {
      const records = group.records || [];
      for (const rec of records) {
        list.push({
          timestamp: group.timestamp || rec.startDateTime || rec.filingDate,
          timestampString: group.timestampString,
          type: rec.type || (rec.earnings ? 'earnings' : 'event'),
          description: rec.description || rec.category || (rec.earnings ? `Earnings ${rec.quarter || ''}` : ''),
          ticker: rec.ticker,
          companyName: rec.companyName || rec.companyShortName,
          epsActual: rec.epsActual,
          epsEstimate: rec.epsEstimate,
          surprisePercent: rec.surprisePercent,
          ...rec,
        });
      }
    }
    return list;
  }
  const list = Array.isArray(data) ? data : (data.events || data.result || data.data || (data.events_calendar ? (Array.isArray(data.events_calendar) ? data.events_calendar : []) : []));
  return Array.isArray(list) ? list : [];
}

async function main() {
  const apiKey = (process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '').trim();
  if (!apiKey) {
    console.error('RAPIDAPI_KEY (ou X_RAPIDAPI_KEY) manquant dans .env');
    process.exit(1);
  }

  const symbolsFromArgs = process.argv.slice(2).filter(Boolean).map((s) => String(s).toUpperCase());
  const symbols = symbolsFromArgs.length ? symbolsFromArgs : loadWatchlist();
  console.log('TradingView events calendar:', symbols.length, 'symbol(s)', symbols.join(', '));

  const by_symbol = {};
  const errors = [];

  for (const symbol of symbols) {
    try {
      const events = await fetchEventsForSymbol(apiKey, symbol);
      by_symbol[symbol] = events;
      console.log('OK', symbol, events.length, 'event(s)');
    } catch (e) {
      console.error('Skip', symbol, e.message || e);
      errors.push({ symbol, error: (e.message || String(e)).slice(0, 200) });
      by_symbol[symbol] = [];
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const payload = {
    last_updated_utc: new Date().toISOString(),
    source: 'tradingview18.p.rapidapi.com',
    endpoint: 'symbols/get-events-calendar',
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
