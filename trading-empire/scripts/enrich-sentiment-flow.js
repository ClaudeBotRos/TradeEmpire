#!/usr/bin/env node
/**
 * TradeEmpire — Enrichissement du sentiment : ventes/achats (funding rate = pression long/short).
 * Lit le digest sentiment du jour (data/signals/sentiment/YYYY-MM-DD_x_digest.json), récupère
 * le funding rate par symbole (Binance Futures), et écrit un digest enrichi avec :
 * - funding_rate_by_symbol
 * - buy_sell_pressure_by_symbol (acheteurs / vendeurs / neutre selon funding)
 * - interprétation pour les agents (orchestrator, idées).
 * Usage: node scripts/enrich-sentiment-flow.js [date YYYY-MM-DD]
 *   Sans date : utilise aujourd'hui. À lancer après sentiment-scan.js (ou smart-money-scan).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SIGNALS_DIR = path.join(ROOT, 'data', 'signals', 'sentiment');
const WATCHLIST_PATH = path.join(ROOT, 'data', 'dashboard', 'watchlist.json');
const FETCH_FUNDING = path.join(__dirname, 'fetch-funding.js');

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'AVAXUSDT', 'LINKUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'ADAUSDT', 'MATICUSDT', 'DOTUSDT', 'ATOMUSDT', 'LTCUSDT'];

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_PATH)) return DEFAULT_SYMBOLS;
  try {
    const data = JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
    return Array.isArray(data.symbols) ? data.symbols : DEFAULT_SYMBOLS;
  } catch (_) {
    return DEFAULT_SYMBOLS;
  }
}

function fetchFundingForSymbol(symbol) {
  try {
    const out = execSync(`node "${FETCH_FUNDING}" "${symbol}"`, { encoding: 'utf8', cwd: ROOT });
    return JSON.parse(out);
  } catch (_) {
    return null;
  }
}

function pressureFromFunding(fundingRate) {
  if (fundingRate > 0.0001) return 'vendeurs';   // longs paient → pression vendeurs (shorts dominants)
  if (fundingRate < -0.0001) return 'acheteurs';  // shorts paient → pression acheteurs (longs dominants)
  return 'neutre';
}

function main() {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  const digestPath = path.join(SIGNALS_DIR, `${date}_x_digest.json`);
  if (!fs.existsSync(digestPath)) {
    console.warn('Digest sentiment absent:', digestPath, '— exécute sentiment-scan.js d\'abord.');
    process.exit(1);
  }

  let baseDigest;
  try {
    baseDigest = JSON.parse(fs.readFileSync(digestPath, 'utf8'));
  } catch (e) {
    console.error('Lecture digest:', e.message);
    process.exit(1);
  }

  const symbols = loadWatchlist();
  const funding_by_symbol = {};
  const buy_sell_pressure_by_symbol = {};

  for (const symbol of symbols) {
    const data = fetchFundingForSymbol(symbol);
    if (data && typeof data.fundingRate === 'number') {
      funding_by_symbol[symbol] = data.fundingRate;
      buy_sell_pressure_by_symbol[symbol] = pressureFromFunding(data.fundingRate);
    } else {
      funding_by_symbol[symbol] = null;
      buy_sell_pressure_by_symbol[symbol] = 'inconnu';
    }
  }

  const flowDigest = {
    ...baseDigest,
    timestamp_utc: new Date().toISOString(),
    enriched_at: Date.now(),
    funding_rate_by_symbol: funding_by_symbol,
    buy_sell_pressure_by_symbol: buy_sell_pressure_by_symbol,
    interpretation: 'Funding > 0 : vendeurs (longs paient, shorts dominants). Funding < 0 : acheteurs (shorts paient, longs dominants). À croiser avec sentiment X et techniques.',
  };

  const flowPath = path.join(SIGNALS_DIR, `${date}_sentiment_flow.json`);
  if (!fs.existsSync(SIGNALS_DIR)) fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  fs.writeFileSync(flowPath, JSON.stringify(flowDigest, null, 2), 'utf8');
  console.log('OK', flowPath, '— ventes/achats (funding) enrichis pour', Object.keys(buy_sell_pressure_by_symbol).length, 'symboles.');
}

main();
