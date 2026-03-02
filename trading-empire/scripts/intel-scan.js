#!/usr/bin/env node
/**
 * TradeEmpire — Intel (Daphnée) : Trend Cards à partir de X et des top vidéos crypto.
 * - X : tendances du jour (Twitter API v2 search recent crypto/bitcoin).
 * - YouTube : recherche automatique via YouTube Data API v3 (YOUTUBE_API_KEY ou GOOGLE_API_KEY).
 *   Si aucune clé : fallback sur dashboard/config/intel_youtube_urls.json.
 * Écrit data/dashboard/intel/trend_cards.json et intel_scan_status.json.
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
const SCAN_STATUS_PATH = path.join(INTEL_DIR, 'intel_scan_status.json');
const ECONOMIC_CALENDAR_PATH = path.join(INTEL_DIR, 'economic_calendar.json');

const OPENCLAW_ROOT = path.join(ROOT, '..', '..', '..', '..');
const YT_TRANSCRIPT_SCRIPT = path.join(OPENCLAW_ROOT, 'skills', 'youtube-watcher', 'scripts', 'get_transcript.py');

async function fetchXTrends() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return { data: null, error: 'X_BEARER_TOKEN non défini (workspace/.env)' };
  const query = encodeURIComponent('crypto OR bitcoin OR BTC OR ethereum -is:retweet lang:en');
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=25&tweet.fields=created_at,text`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: `X API ${res.status}: ${(text || res.statusText).slice(0, 200)}` };
    }
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: (e && e.message) ? e.message : 'Erreur réseau X' };
  }
}

function deriveTrendThemes(tweets) {
  if (!tweets?.data?.length) return { title: 'Tendances X — crypto du jour', summary: 'Aucune donnée X (token absent ou API indisponible).', themes: [] };
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
  if (!fs.existsSync(YT_TRANSCRIPT_SCRIPT)) return { transcript: null, error: 'Script get_transcript.py introuvable (skills/youtube-watcher)' };
  try {
    const out = execSync(`python3 "${YT_TRANSCRIPT_SCRIPT}" "${url}"`, { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
    return { transcript: (out || '').trim().slice(0, 800), error: null };
  } catch (e) {
    return { transcript: null, error: (e && e.message) ? e.message : 'Erreur transcript' };
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

/** Recherche YouTube automatique (Daphnée) — YouTube Data API v3. Retourne [{ url, title }]. */
async function searchYouTubeVideos(apiKey, query, maxResults = 5) {
  if (!apiKey || !String(apiKey).trim()) return [];
  const q = encodeURIComponent(query);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${q}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || [];
    return items
      .filter((i) => i.id && i.id.videoId)
      .map((i) => ({
        url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
        title: (i.snippet && i.snippet.title) ? i.snippet.title.trim() : null,
      }));
  } catch (_) {
    return [];
  }
}

async function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const timestampUtc = now.toISOString();
  const cards = [];
  const scanStatus = {
    last_run_utc: timestampUtc,
    x: { status: 'ok', message: null },
    youtube: { status: 'ok', count_ok: 0, count_fail: 0, errors: [] },
  };

  const xResult = await fetchXTrends();
  const xData = xResult.data;
  if (xResult.error) {
    scanStatus.x = { status: 'error', message: xResult.error };
  }
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

  const youtubeApiKey = (process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  let youtubeList = [];
  if (youtubeApiKey) {
    const searched = await searchYouTubeVideos(youtubeApiKey, 'crypto bitcoin news', 5);
    youtubeList = searched.map((e) => ({ url: e.url, title: e.title }));
  }
  if (!youtubeList.length) {
    youtubeList = loadYoutubeUrls().filter((e) => e && (e.url || (typeof e === 'string' && e.startsWith('http'))));
  }
  for (let i = 0; i < youtubeList.length; i++) {
    const entry = typeof youtubeList[i] === 'string' ? { url: youtubeList[i], title: null } : youtubeList[i];
    const url = entry.url && entry.url.trim();
    if (!url || !url.includes('youtube.com')) continue;
    const result = getYoutubeTranscript(url);
    const transcript = result.transcript;
    if (result.error) {
      scanStatus.youtube.count_fail += 1;
      scanStatus.youtube.errors.push({ url: url.slice(0, 80), error: result.error });
    } else {
      scanStatus.youtube.count_ok += 1;
    }
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
  if (scanStatus.youtube.errors.length) {
    scanStatus.youtube.status = scanStatus.youtube.count_ok > 0 ? 'partial' : 'error';
  }

  // Carte Macro (calendrier économique) si des événements sont présents
  if (fs.existsSync(ECONOMIC_CALENDAR_PATH)) {
    try {
      const cal = JSON.parse(fs.readFileSync(ECONOMIC_CALENDAR_PATH, 'utf8'));
      const events = Array.isArray(cal.events) ? cal.events : [];
      const today = date;
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const todayEvents = events.filter((e) => e.date === today);
      const recentWithActual = events.filter((e) => (e.date === today || e.date === yesterday) && e.actual != null && String(e.actual).trim() !== '');
      const lines = [];
      if (todayEvents.length) {
        lines.push('Aujourd\'hui : ' + todayEvents.map((e) => (e.country ? e.country + ' ' : '') + (e.event || '')).join(' ; '));
      }
      if (recentWithActual.length) {
        lines.push('Publiés récemment : ' + recentWithActual.map((e) => (e.event || '') + ' = ' + e.actual + (e.forecast != null ? ' (attendu ' + e.forecast + ')' : '')).join(' ; '));
      }
      if (lines.length) {
        cards.push({
          id: `macro-${date}-${Date.now()}`,
          source: 'economic_calendar',
          title: 'Calendrier économique (macro)',
          summary: lines.join(' — '),
          url: 'https://www.investing.com/economic-calendar',
          classification: 'borderline',
          date,
          timestamp_utc: timestampUtc,
        });
      }
    } catch (_) {}
  }

  if (!fs.existsSync(INTEL_DIR)) fs.mkdirSync(INTEL_DIR, { recursive: true });
  const output = { timestamp_utc: timestampUtc, date, cards };
  fs.writeFileSync(TREND_CARDS_PATH, JSON.stringify(output, null, 2), 'utf8');
  fs.writeFileSync(SCAN_STATUS_PATH, JSON.stringify(scanStatus, null, 2), 'utf8');
  try {
    const { appendWire } = require('./wire-log.js');
    appendWire({
      from_agent: 'INTEL',
      to_agent: 'BROADCAST',
      type: 'SHARE_SIGNAL',
      context: { window: 'intel_trend_cards' },
      content_summary: `Trend Cards : ${cards.filter((c) => c.source === 'x').length} X, ${cards.filter((c) => c.source === 'youtube').length} YouTube${cards.some((c) => c.source === 'economic_calendar') ? ', 1 macro (calendrier éco)' : ''}.`,
      content_ref: 'data/dashboard/intel/trend_cards.json',
    });
  } catch (_) {}
  console.log('OK', TREND_CARDS_PATH, '| X:', scanStatus.x.status, '| YouTube:', scanStatus.youtube.count_ok, 'ok', scanStatus.youtube.count_fail, 'fail');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
