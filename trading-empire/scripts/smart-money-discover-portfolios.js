#!/usr/bin/env node
/**
 * TradeEmpire — Découverte des portfolio IDs Binance Copy Trading à surveiller via Apify.
 * Délégation à l’agent Smart Money : ce script remplit data/signals/smart_money/binance_copy_portfolio_ids.txt
 * à partir du leaderboard scrapé par l’acteur Apify brilliant_gum/binance-copy-trading-scraper (mode leaderboard).
 *
 * Sortie : binance_copy_portfolio_ids.txt (un portfolioId par ligne).
 * Requiert : APIFY_API_TOKEN (ou APIFY_TOKEN) dans workspace/.env.
 * Usage : node scripts/smart-money-discover-portfolios.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIGNALS_DIR = path.join(ROOT, 'data', 'signals', 'smart_money');
const OUT_FILE = path.join(SIGNALS_DIR, 'binance_copy_portfolio_ids.txt');
const ACTOR_ID = 'brilliant_gum~binance-copy-trading-scraper';

async function main() {
  const token = (process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || '').trim();
  if (!token) {
    console.log('APIFY_API_TOKEN (ou APIFY_TOKEN) non défini — découverte Binance Copy ignorée. Définir dans .env pour remplir binance_copy_portfolio_ids.txt via Apify.');
    return;
  }

  const input = {
    mode: 'leaderboard',
    maxTraders: 30,
    withPositions: false,
    period: 'MONTHLY',
    sortBy: 'PNL',
  };
  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180`;
  let items = [];
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Apify Binance Copy discovery:', res.status, err.slice(0, 300));
      return;
    }
    items = await res.json();
    if (!Array.isArray(items)) items = [];
  } catch (e) {
    console.error('Apify Binance Copy discovery:', e.message);
    return;
  }

  const ids = [];
  const seen = new Set();
  for (const item of items) {
    if (item.type !== 'trader') continue;
    const id = item.portfolioId != null ? String(item.portfolioId).trim() : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  if (!fs.existsSync(SIGNALS_DIR)) fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, ids.join('\n') + (ids.length ? '\n' : ''), 'utf8');
  console.log('Découverte Binance Copy :', ids.length, 'portfolio(s) écrits dans', path.basename(OUT_FILE));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
