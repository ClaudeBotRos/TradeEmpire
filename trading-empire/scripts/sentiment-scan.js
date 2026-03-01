#!/usr/bin/env node
/**
 * TradeEmpire — Scan sentiment : produit data/signals/sentiment/{date}_x_digest.json
 * Si X_BEARER_TOKEN (workspace/.env) est défini : appelle Twitter API v2 search recent (crypto/bitcoin).
 * Sinon : stub (narratives neutres, low_confidence).
 * Usage: node sentiment-scan.js [SYMBOL1] [SYMBOL2] ...
 */

const fs = require('fs');
const path = require('path');

require('./load-workspace-env.js');

const ROOT = path.join(__dirname, '..');
const WATCHLIST = process.argv.slice(2).length ? process.argv.slice(2) : ['BTCUSDT'];
const SIGNALS_DIR = path.join(ROOT, 'data', 'signals', 'sentiment');

async function fetchTwitterRecent() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return null;
  const query = encodeURIComponent('crypto OR bitcoin OR BTC -is:retweet lang:en');
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,text`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

function deriveNarratives(tweets) {
  if (!tweets || !tweets.data || !tweets.data.length) return ['stub_narrative'];
  const texts = tweets.data.map((t) => (t.text || '').toLowerCase());
  const narratives = [];
  if (texts.some((t) => t.includes('bull') || t.includes('pump'))) narratives.push('bullish mentions');
  if (texts.some((t) => t.includes('bear') || t.includes('dump'))) narratives.push('bearish mentions');
  if (texts.some((t) => t.includes('etf'))) narratives.push('ETF narrative');
  if (!narratives.length) narratives.push('mixed_or_neutral');
  return narratives;
}

async function main() {
  if (!fs.existsSync(SIGNALS_DIR)) {
    fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const timestampUtc = now.toISOString();

  const sentimentBySymbol = {};
  for (const s of WATCHLIST) sentimentBySymbol[s] = 'neutral';

  const tweets = await fetchTwitterRecent();
  const narratives = tweets ? deriveNarratives(tweets) : ['stub_narrative'];
  const lowConfidence = !tweets;

  const digest = {
    timestamp_utc: timestampUtc,
    date,
    narratives,
    sentiment_by_symbol: sentimentBySymbol,
    risk_signals: [],
    sources: tweets
      ? [{ type: 'x', ref: 'twitter_api_v2_search_recent' }]
      : [{ type: 'stub', ref: 'manual_or_cron' }],
    low_confidence: lowConfidence,
  };

  const filepath = path.join(SIGNALS_DIR, `${date}_x_digest.json`);
  fs.writeFileSync(filepath, JSON.stringify(digest, null, 2), 'utf8');
  console.log('OK', filepath, tweets ? '(X API)' : '(stub)');
}

main();
