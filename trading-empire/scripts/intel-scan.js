#!/usr/bin/env node
/**
 * TradeEmpire — Intel (Daphnée) : Trend Cards à partir de X et des top vidéos crypto.
 * - X : tendances du jour (Twitter API v2 search recent crypto/bitcoin).
 * - YouTube : URLs dans dashboard/config/intel_youtube_urls.json, transcript via skill youtube-watcher.
 * Écrit data/dashboard/intel/trend_cards.json.
 * Usage: node scripts/intel-scan.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INTEL_DIR = path.join(ROOT, 'data', 'dashboard', 'intel');
const CONFIG_DIR = path.join(ROOT, 'dashboard', 'config');
const YOUTUBE_URLS_PATH = path.join(CONFIG_DIR, 'intel_youtube_urls.json');
const TREND_CARDS_PATH = path.join(INTEL_DIR, 'trend_cards.json');

const OPENCLAW_ROOT = path.join(ROOT, '..', '..', '..', '..');
const YT_TRANSCRIPT_SCRIPT = path.join(OPENCLAW_ROOT, 'skills', 'youtube-watcher', 'scripts', 'get_transcript.py');

async function fetchXTrends() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return null;
  const query = encodeURIComponent('crypto OR bitcoin OR BTC OR ethereum -is:retweet lang:en');
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=25&tweet.fields=created_at,text`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

function deriveTrendThemes(tweets) {
  if (!tweets?.data?.length) return { title: 'Tendances X', summary: 'Aucune donnée X (token absent ou API indisponible).', themes: [] };
  const texts = tweets.data.map((t) => (t.text || '').toLowerCase());
  const themes = [];
  if (texts.some((t) => t.includes('etf') || t.includes('spot etf'))) themes.push('ETF / spot');
  if (texts.some((t) => t.includes('bull') || t.includes('pump'))) themes.push('bullish');
  if (texts.some((t) => t.includes('bear') || t.includes('dump'))) themes.push('bearish');
  if (texts.some((t) => t.includes('halving'))) themes.push('halving');
  if (texts.some((t) => t.includes('sec') || t.includes('regulation'))) themes.push('régulation');
  if (texts.some((t) => t.includes('defi') || t.includes('defi'))) themes.push('DeFi');
  if (!themes.length) themes.push('mixed / neutral');
  const summary = `Dernières tendances X (crypto/bitcoin) : ${themes.join(', ')}. ${tweets.data.length} tweets récents.`;
  return { title: 'Tendances X — crypto du jour', summary, themes };
}

function getYoutubeTranscript(url) {
  if (!fs.existsSync(YT_TRANSCRIPT_SCRIPT)) return null;
  try {
    const out = execSync(`python3 "${YT_TRANSCRIPT_SCRIPT}" "${url}"`, { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
    return (out || '').trim().slice(0, 800);
  } catch (_) {
    return null;
  }
}

function loadYoutubeUrls() {
  if (!fs.existsSync(YOUTUBE_URLS_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(YOUTUBE_URLS_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

async function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const timestampUtc = now.toISOString();
  const cards = [];

  const xData = await fetchXTrends();
  const xTrend = deriveTrendThemes(xData);
  cards.push({
    id: `x-${date}-${Date.now()}`,
    source: 'x',
    title: xTrend.title,
    summary: xTrend.summary,
    url: null,
    classification: 'borderline',
    date,
    timestamp_utc: timestampUtc,
  });

  const youtubeList = loadYoutubeUrls().filter((e) => e && (e.url || (typeof e === 'string' && e.startsWith('http'))));
  for (let i = 0; i < youtubeList.length; i++) {
    const entry = typeof youtubeList[i] === 'string' ? { url: youtubeList[i], title: null } : youtubeList[i];
    const url = entry.url && entry.url.trim();
    if (!url || !url.includes('youtube.com')) continue;
    const transcript = getYoutubeTranscript(url);
    const title = entry.title && entry.title.trim() ? entry.title.trim() : `Vidéo crypto ${i + 1}`;
    const summary = transcript ? `${transcript.slice(0, 400)}${transcript.length > 400 ? '…' : ''}` : 'Vidéo crypto du jour (transcript non disponible).';
    cards.push({
      id: `yt-${date}-${i}-${Date.now()}`,
      source: 'youtube',
      title,
      summary,
      url,
      classification: 'borderline',
      date,
      timestamp_utc: timestampUtc,
    });
  }

  if (!fs.existsSync(INTEL_DIR)) fs.mkdirSync(INTEL_DIR, { recursive: true });
  const output = { timestamp_utc: timestampUtc, date, cards };
  fs.writeFileSync(TREND_CARDS_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('OK', TREND_CARDS_PATH, '| X:', cards.filter((c) => c.source === 'x').length, '| YouTube:', cards.filter((c) => c.source === 'youtube').length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
