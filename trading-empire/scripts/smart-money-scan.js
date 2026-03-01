#!/usr/bin/env node
/**
 * TradeEmpire — Scan smart money : funding rate par symbole (Binance Futures), écrit data/signals/smart_money/{symbol}_{timestamp}.json
 * Usage: node smart-money-scan.js [SYMBOL1] [SYMBOL2] ...
 * Default: BTCUSDT
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const WATCHLIST = process.argv.slice(2).length ? process.argv.slice(2) : ['BTCUSDT'];
const SIGNALS_DIR = path.join(ROOT, 'data', 'signals', 'smart_money');
const FETCH_SCRIPT = path.join(__dirname, 'fetch-funding.js');

function fetchFundingForSymbol(symbol) {
  try {
    const out = execSync(`node "${FETCH_SCRIPT}" "${symbol}"`, { encoding: 'utf8', cwd: ROOT });
    return JSON.parse(out);
  } catch (e) {
    return null;
  }
}

function deriveSignals(fundingRate) {
  if (fundingRate > 0.0001) return ['funding positive'];
  if (fundingRate < -0.0001) return ['funding negative'];
  return ['funding neutral'];
}

function main() {
  if (!fs.existsSync(SIGNALS_DIR)) {
    fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const timestampUtc = now.toISOString();

  for (const symbol of WATCHLIST) {
    const data = fetchFundingForSymbol(symbol);
    const lowConfidence = !data;

    const signal = {
      timestamp_utc: timestampUtc,
      symbol,
      signals: data ? deriveSignals(data.fundingRate) : [],
      metrics: data
        ? {
            funding: data.fundingRate,
            mark_price: data.markPrice,
            next_funding_time: data.nextFundingTime,
          }
        : {},
      sources: data
        ? [{ type: 'exchange', ref: 'binance_futures_premiumIndex' }]
        : [{ type: 'error', ref: 'binance_futures_unavailable' }],
      low_confidence: lowConfidence,
    };

    const filepath = path.join(SIGNALS_DIR, `${symbol}_${timestamp}.json`);
    fs.writeFileSync(filepath, JSON.stringify(signal, null, 2), 'utf8');
    console.log('OK', filepath);
  }
}

main();
