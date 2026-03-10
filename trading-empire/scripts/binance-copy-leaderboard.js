#!/usr/bin/env node
/**
 * TradeEmpire — Smart Money (Lucas) : leaderboard Binance Copy Trading (RapidAPI).
 * Doc : https://rapidapi.com/udaydeepyadav/api/binance-copy-trading-leaderboard-api
 * - GET /futures/v1/leaderboard → peut renvoyer 404 (endpoint absent selon abonnement).
 * - POST /futures/v1/lead-portfolio { portfolioId } → détail d'un portfolio (fonctionne).
 * Utilise RAPIDAPI_KEY. Recommandé : BINANCE_COPY_PORTFOLIO_IDS (IDs séparés par des virgules) pour récupérer des portfolios.
 * Sortie : data/signals/smart_money/binance_copy_leaderboard.json
 * Usage: node scripts/binance-copy-leaderboard.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIGNALS_DIR = path.join(ROOT, 'data', 'signals', 'smart_money');
const OUT_PATH = path.join(SIGNALS_DIR, 'binance_copy_leaderboard.json');

const HOST = 'binance-copy-trading-leaderboard-api.p.rapidapi.com';
const BASE = `https://${HOST}`;

async function apiGet(apiKey, path) {
  const res = await fetch(BASE + path, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'x-rapidapi-host': HOST,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  return { status: res.status, data, text: text.slice(0, 300) };
}

async function apiPost(apiKey, path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'x-rapidapi-host': HOST,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  return { status: res.status, data, text: text.slice(0, 300) };
}

async function main() {
  const apiKey = (process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '').trim();
  if (!apiKey) {
    console.error('RAPIDAPI_KEY (ou X_RAPIDAPI_KEY) manquant dans .env');
    process.exit(1);
  }

  const out = {
    last_updated_utc: new Date().toISOString(),
    source: HOST,
    leaderboard: null,
    portfolios: [],
    errors: [],
  };

  // 1) Leaderboard (liste des tops)
  const lb = await apiGet(apiKey, '/futures/v1/leaderboard');
  if (lb.status === 200 && lb.data) {
    out.leaderboard = Array.isArray(lb.data) ? lb.data : (lb.data.data || lb.data.leaderboard || lb.data.list || [lb.data]);
    if (!Array.isArray(out.leaderboard)) out.leaderboard = [];
    console.log('OK leaderboard', out.leaderboard.length, 'entrée(s)');
  } else {
    out.errors.push('leaderboard: ' + (lb.status === 429 ? 'Too many requests' : lb.status === 404 ? 'Endpoint non disponible ou abonnement' : `HTTP ${lb.status}`));
  }

  // 2) Détails portfolios : IDs depuis env, fichier, ou leaderboard (max 15 pour limiter le rate limit)
  let portfolioIds = [];
  const fromEnv = (process.env.BINANCE_COPY_PORTFOLIO_IDS || '').trim().split(',').map((s) => s.trim()).filter(Boolean);
  if (fromEnv.length) {
    portfolioIds = fromEnv.slice(0, 15);
  } else {
    const idsFile = (process.env.BINANCE_COPY_PORTFOLIO_IDS_FILE || '').trim() || path.join(SIGNALS_DIR, 'binance_copy_portfolio_ids.txt');
    if (fs.existsSync(idsFile)) {
      portfolioIds = fs.readFileSync(idsFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 15);
      if (portfolioIds.length) console.log('Portfolio IDs lus depuis', path.basename(idsFile), ':', portfolioIds.length);
    }
    if (portfolioIds.length === 0 && out.leaderboard && out.leaderboard.length) {
      portfolioIds = out.leaderboard.slice(0, 5).map((e) => e.portfolioId || e.id || e.leaderUid).filter(Boolean);
    }
  }
  if (portfolioIds.length === 0 && (out.errors.length || !out.leaderboard)) {
    console.log('Astuce : définir BINANCE_COPY_PORTFOLIO_IDS (virgules) ou créer data/signals/smart_money/binance_copy_portfolio_ids.txt (un ID par ligne).');
  }

  for (let i = 0; i < portfolioIds.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    const post = await apiPost(apiKey, '/futures/v1/lead-portfolio', { portfolioId: portfolioIds[i] });
    if (post.status === 200 && post.data) {
      out.portfolios.push({ portfolioId: portfolioIds[i], ...post.data });
      console.log('OK portfolio', portfolioIds[i]);
    } else {
      out.errors.push('portfolio ' + portfolioIds[i] + ': ' + (post.status === 429 ? 'Too many requests' : 'HTTP ' + post.status));
    }
  }

  if (!fs.existsSync(SIGNALS_DIR)) fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  const lbCount = Array.isArray(out.leaderboard) ? out.leaderboard.length : 0;
  const portCount = out.portfolios.length;
  console.log('Écrit:', OUT_PATH, '| leaderboard:', lbCount, '| portfolios:', portCount, '| erreurs:', out.errors.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
