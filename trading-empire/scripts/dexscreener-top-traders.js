#!/usr/bin/env node
/**
 * TradeEmpire — Smart Money (Lucas) : top traders / holders via Dexscreener (RapidAPI).
 * Doc API : https://rapidapi.com/scrapewizard-scrapewizard-default/api/dexscreener-top-traders
 * GET https://dexscreener-top-traders.p.rapidapi.com/get_holders?wallet_url=...
 * Plusieurs wallets : DEXSCREENER_WALLET_URLS (virgules) ou fichier (DEXSCREENER_WALLETS_FILE ou data/signals/smart_money/dexscreener_wallets.txt), une URL par ligne.
 * Sinon : DEXSCREENER_WALLET_URL ou argument unique.
 * Sortie: data/signals/smart_money/dexscreener_holders.json (wallets[] + holders fusionnés)
 * Usage: node scripts/dexscreener-top-traders.js [WALLET_URL]
 * Voir docs/DEXSCREENER_TOP_TRADERS.md
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIGNALS_DIR = path.join(ROOT, 'data', 'signals', 'smart_money');
const OUT_PATH = path.join(SIGNALS_DIR, 'dexscreener_holders.json');
const DEFAULT_WALLETS_FILE = path.join(SIGNALS_DIR, 'dexscreener_wallets.txt');

const HOST = 'dexscreener-top-traders.p.rapidapi.com';

function getWalletUrls() {
  const arg = process.argv[2];
  if (arg && arg.startsWith('http')) {
    return [arg.trim()];
  }
  const fromEnv = (process.env.DEXSCREENER_WALLET_URLS || '').trim().split(',').map((s) => s.trim()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const single = (process.env.DEXSCREENER_WALLET_URL || '').trim();
  if (single) return [single];
  const filePath = (process.env.DEXSCREENER_WALLETS_FILE || '').trim() || DEFAULT_WALLETS_FILE;
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && s.startsWith('http'));
    if (lines.length) return lines;
  }
  return [];
}

async function fetchHoldersForWallet(apiKey, walletUrl) {
  const url = `https://${HOST}/get_holders?wallet_url=${encodeURIComponent(walletUrl)}`;
  try {
    const res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': apiKey, 'x-rapidapi-host': HOST },
    });
    const text = await res.text();
    if (!res.ok) return { wallet_url: walletUrl, holders: [], error: `HTTP ${res.status}`, http_status: res.status };
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      return { wallet_url: walletUrl, holders: [], error: 'Réponse non-JSON', http_status: res.status };
    }
    const holders = Array.isArray(data) ? data : (data.holders || data.data || data.result || []);
    return { wallet_url: walletUrl, holders: Array.isArray(holders) ? holders : [], http_status: res.status };
  } catch (e) {
    return { wallet_url: walletUrl, holders: [], error: (e.message || String(e)).slice(0, 150), http_status: null };
  }
}

async function main() {
  const apiKey = (process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '').trim();
  if (!apiKey) {
    console.error('RAPIDAPI_KEY (ou X_RAPIDAPI_KEY) manquant dans .env');
    process.exit(1);
  }

  const walletUrls = getWalletUrls();
  if (!walletUrls.length) {
    const payload = {
      last_updated_utc: new Date().toISOString(),
      source: HOST,
      endpoint: 'get_holders',
      error: 'Aucun wallet : définir DEXSCREENER_WALLET_URL, DEXSCREENER_WALLET_URLS (virgules), ou créer ' + path.basename(DEFAULT_WALLETS_FILE) + ' (une URL Dexscreener par ligne).',
      wallets: [],
      holders: [],
      count: 0,
    };
    if (!fs.existsSync(SIGNALS_DIR)) fs.mkdirSync(SIGNALS_DIR, { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
    console.log('OK', OUT_PATH, '| aucun wallet configuré — voir DEXSCREENER_* ou', DEFAULT_WALLETS_FILE);
    return;
  }

  const wallets = [];
  const allHolders = [];
  for (let i = 0; i < walletUrls.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 600));
    const result = await fetchHoldersForWallet(apiKey, walletUrls[i]);
    wallets.push(result);
    if (result.holders && result.holders.length) {
      result.holders.forEach((h) => allHolders.push({ ...h, wallet_url: walletUrls[i] }));
    }
    const status = result.error ? result.error : result.holders.length + ' holder(s)';
    console.log('Wallet', i + 1 + '/' + walletUrls.length, walletUrls[i].slice(0, 50) + '...', '→', status);
  }

  if (!fs.existsSync(SIGNALS_DIR)) fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  const payload = {
    last_updated_utc: new Date().toISOString(),
    source: HOST,
    endpoint: 'get_holders',
    wallet_url: walletUrls.length === 1 ? walletUrls[0] : undefined,
    wallets,
    holders: allHolders,
    count: allHolders.length,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log('Écrit:', OUT_PATH, '|', walletUrls.length, 'wallet(s),', allHolders.length, 'holder(s)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
