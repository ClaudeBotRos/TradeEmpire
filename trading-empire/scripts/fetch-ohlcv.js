#!/usr/bin/env node
/**
 * TradeEmpire — Récupère les klines OHLCV depuis Binance (API publique).
 * Usage: node fetch-ohlcv.js [SYMBOL] [INTERVAL] [LIMIT]
 * Default: BTCUSDT 4h 100
 * Sortie: JSON sur stdout (array of { openTime, open, high, low, close, volume }).
 */

const symbol = process.argv[2] || 'BTCUSDT';
const interval = process.argv[3] || '4h';
const limit = parseInt(process.argv[4] || '100', 10);

const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

async function fetchOHLCV() {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Binance API ${res.status}: ${await res.text()}`);
  }
  const raw = await res.json();
  return raw.map((c) => ({
    openTime: c[0],
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

fetchOHLCV()
  .then((candles) => {
    console.log(JSON.stringify(candles));
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
