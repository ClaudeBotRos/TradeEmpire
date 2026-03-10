#!/usr/bin/env node
/**
 * TradeEmpire — Intel (Daphnée) : Reddit — subreddits similaires (crypto) via RapidAPI.
 * GET https://reddit34.p.rapidapi.com/getSimilarSubreddits?subreddit=XXX
 * Utilise RAPIDAPI_KEY (workspace/.env).
 * Sortie: data/dashboard/intel/reddit_intel.json
 * Usage: node scripts/reddit-intel.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INTEL_DIR = path.join(ROOT, 'data', 'dashboard', 'intel');
const OUT_PATH = path.join(INTEL_DIR, 'reddit_intel.json');

const HOST = 'reddit34.p.rapidapi.com';

const CRYPTO_SUBS = ['cryptocurrency', 'bitcoin', 'ethereum', 'CryptoCurrency', 'defi'];

async function fetchSimilarSubreddits(apiKey, subreddit) {
  const url = `https://${HOST}/getSimilarSubreddits?subreddit=${encodeURIComponent(subreddit)}`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'x-rapidapi-host': HOST,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 150)}`);
  }
  const data = await res.json();
  if (!data.success || !data.data || !Array.isArray(data.data.subreddits)) return [];
  return data.data.subreddits.map((s) => {
    const d = s.data || s;
    return {
      display_name: d.display_name || d.name || subreddit,
      title: (d.title || '').slice(0, 200),
      url: d.url ? `https://reddit.com${d.url}` : `https://reddit.com/r/${d.display_name || subreddit}`,
      subscribers: d.subscribers,
      description: (d.public_description || d.description || '').slice(0, 300),
    };
  });
}

async function main() {
  const apiKey = (process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '').trim();
  if (!apiKey) {
    console.error('RAPIDAPI_KEY (ou X_RAPIDAPI_KEY) manquant dans .env');
    process.exit(1);
  }

  const by_query = {};
  const seen = new Set();
  const all = [];

  for (const sub of CRYPTO_SUBS) {
    try {
      const list = await fetchSimilarSubreddits(apiKey, sub);
      by_query[sub] = list;
      for (const item of list) {
        const key = (item.display_name || '').toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          all.push({ ...item, from_query: sub });
        }
      }
      console.log('OK', sub, list.length, 'similar');
    } catch (e) {
      console.error('Skip', sub, e.message || e);
      by_query[sub] = [];
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!fs.existsSync(INTEL_DIR)) fs.mkdirSync(INTEL_DIR, { recursive: true });

  const payload = {
    last_updated_utc: new Date().toISOString(),
    source: HOST,
    endpoint: 'getSimilarSubreddits',
    subreddits: all,
    by_query,
    count: all.length,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log('OK', OUT_PATH, '|', all.length, 'subreddit(s)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
