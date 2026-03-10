#!/usr/bin/env node
/**
 * TradeEmpire — Découverte des wallets à surveiller (Dexscreener) via Apify.
 * Délégation à l’agent Smart Money : ce script remplit data/signals/smart_money/dexscreener_wallets.txt
 * à partir des "top traders" retournés par l’acteur Apify crypto-scraper/dexscreener-top-traders-scraper.
 *
 * Entrée : tokens à analyser (chaque token → on récupère ses top traders, dont les adresses wallet).
 * - Fichier data/signals/smart_money/dexscreener_seed_tokens.txt : une ligne par token "chain,address"
 *   (ex. solana,4gmic8GGP6q4R3W2yAjASg2et2Ty8swrA2vLe1f421aY)
 * - Ou env DEXSCREENER_SEED_TOKENS : JSON array [{chain,address}] ou "chain:address,chain:address"
 *
 * Sortie : dexscreener_wallets.txt (une URL https://dexscreener.com/{chain}/{wallet} par ligne).
 * Requiert : APIFY_API_TOKEN (ou APIFY_TOKEN) dans workspace/.env.
 * Usage : node scripts/smart-money-discover-wallets.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIGNALS_DIR = path.join(ROOT, 'data', 'signals', 'smart_money');
const SEED_FILE = path.join(SIGNALS_DIR, 'dexscreener_seed_tokens.txt');
const OUT_FILE = path.join(SIGNALS_DIR, 'dexscreener_wallets.txt');
const ACTOR_ID = 'crypto-scraper~dexscreener-top-traders-scraper';

function getSeedTokens() {
  const fromEnv = process.env.DEXSCREENER_SEED_TOKENS || process.env.DEXSCREENER_SEED_TOKENS_JSON || '';
  if (fromEnv.trim()) {
    try {
      const parsed = JSON.parse(fromEnv);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((t) => ({ chain: (t.chain || 'solana').toLowerCase(), address: String(t.address).trim() })).filter((t) => t.address);
      }
    } catch (_) {}
    const pairs = fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
    return pairs.map((p) => {
      const [chain, address] = p.includes(':') ? p.split(':').map((s) => s.trim()) : ['solana', p];
      return { chain: (chain || 'solana').toLowerCase(), address: address || p };
    }).filter((t) => t.address);
  }
  if (fs.existsSync(SEED_FILE)) {
    const lines = fs.readFileSync(SEED_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
    return lines.map((line) => {
      const [chain, address] = line.split(',').map((s) => s.trim());
      return { chain: (chain || 'solana').toLowerCase(), address: address || line };
    }).filter((t) => t.address);
  }
  return [];
}

async function main() {
  const token = (process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || '').trim();
  if (!token) {
    console.log('APIFY_API_TOKEN (ou APIFY_TOKEN) non défini — découverte Dexscreener ignorée. Définir dans .env pour remplir dexscreener_wallets.txt via Apify.');
    return;
  }

  const seeds = getSeedTokens();
  if (!seeds.length) {
    console.log('Aucun token seed : créer', path.basename(SEED_FILE), 'avec une ligne par token "chain,address" (ex. solana,4gmic8GGP6q4R3W2yAjASg2et2Ty8swrA2vLe1f421aY) ou définir DEXSCREENER_SEED_TOKENS.');
    return;
  }

  const tokens = seeds.slice(0, 5).map((t) => ({ chain: t.chain, address: t.address, timeframe: '7d' }));
  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`;
  let items = [];
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Apify Dexscreener discovery:', res.status, err.slice(0, 300));
      return;
    }
    items = await res.json();
    if (!Array.isArray(items)) items = [];
  } catch (e) {
    console.error('Apify Dexscreener discovery:', e.message);
    return;
  }

  const tokenToChain = Object.fromEntries(tokens.map((t) => [t.address.toLowerCase(), t.chain]));
  const seen = new Set();
  const urls = [];
  for (const item of items) {
    const wallet = item.wallet || item.address;
    if (!wallet || typeof wallet !== 'string') continue;
    const chain = tokenToChain[(item.token || '').toLowerCase()] || item.chain || 'solana';
    const u = `https://dexscreener.com/${chain.toLowerCase()}/${wallet.trim()}`;
    if (seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
  }

  if (!fs.existsSync(SIGNALS_DIR)) fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, urls.join('\n') + (urls.length ? '\n' : ''), 'utf8');
  console.log('Découverte Dexscreener :', urls.length, 'wallet(s) écrits dans', path.basename(OUT_FILE));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
