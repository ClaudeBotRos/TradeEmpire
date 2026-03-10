#!/usr/bin/env node
/**
 * TradeEmpire — Intel (Daphnée) : Trend Cards à partir de X et des top vidéos crypto.
 * - X : tendances du jour (Twitter API v2 search recent crypto/bitcoin).
 * - YouTube : scrape quotidien — top 30–50 vidéos crypto de la veille, transcript requis ; Daphnée pourra filtrer (inutiles, placement influenceurs). Priorité : (1) YouTube Data API v3, (2) npm, (3) RapidAPI, (4) liste manuelle.
 * Écrit data/dashboard/intel/trend_cards.json et intel_scan_status.json.
 * Usage: node scripts/intel-scan.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INTEL_DIR = path.join(ROOT, 'data', 'dashboard', 'intel');
const CONFIG_DIR = path.join(ROOT, 'dashboard', 'config');
const YOUTUBE_URLS_PATH = path.join(CONFIG_DIR, 'intel_youtube_urls.json');
const TREND_CARDS_PATH = path.join(INTEL_DIR, 'trend_cards.json');
const SCAN_STATUS_PATH = path.join(INTEL_DIR, 'intel_scan_status.json');
const ECONOMIC_CALENDAR_PATH = path.join(INTEL_DIR, 'economic_calendar.json');
const CRYPTODAILY_NEWS_PATH = path.join(INTEL_DIR, 'cryptodaily_news.json');
const REDDIT_INTEL_PATH = path.join(INTEL_DIR, 'reddit_intel.json');

const WORKSPACE_ROOT = path.join(ROOT, '..', '..');
const YT_TRANSCRIPT_SCRIPT = path.join(WORKSPACE_ROOT, 'skills', 'youtube-watcher', 'scripts', 'get_transcript.py');

const YOUTUBE_VIDEOS_PER_DAY = Math.min(50, Math.max(10, parseInt(process.env.INTEL_YOUTUBE_VIDEOS_PER_DAY, 10) || 50));
const MAX_YOUTUBE_CARDS = Math.min(50, Math.max(5, parseInt(process.env.INTEL_YOUTUBE_MAX_CARDS, 10) || 30));
const YOUTUBE_FILTER_CONFIG_PATH = path.join(CONFIG_DIR, 'intel_youtube_filter.json');

// Placement crypto uniquement (pousser une crypto/token). Ne pas rejeter pour lien d’affiliation exchange/app ou code promo générique (ex. code HOLY).
const DEFAULT_SHILL_PHRASES = [
  'buy this coin', 'buy this token', 'this coin will', 'this token will', 'next 100x', 'get in early',
  'pump this', 'link to buy', 'where to buy', 'invest in this coin', 'invest in this token',
  'best coin to buy', 'altcoin to buy', 'token to buy', 'coin to buy', 'this altcoin',
  'achète ce token', 'ce token va', 'prochain 100x', 'où acheter ce', 'lien pour acheter',
];

function loadYoutubeFilterConfig() {
  const defaults = {
    shill_phrases: DEFAULT_SHILL_PHRASES,
    min_transcript_length: 80,
    max_borderline_cards: Math.min(15, Math.max(5, parseInt(process.env.INTEL_YOUTUBE_MAX_BORDERLINE_CARDS, 10) || 10)),
  };
  if (!fs.existsSync(YOUTUBE_FILTER_CONFIG_PATH)) {
    return defaults;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(YOUTUBE_FILTER_CONFIG_PATH, 'utf8'));
    return {
      shill_phrases: Array.isArray(raw.shill_phrases) ? raw.shill_phrases : defaults.shill_phrases,
      min_transcript_length: typeof raw.min_transcript_length === 'number' ? raw.min_transcript_length : defaults.min_transcript_length,
      max_borderline_cards: typeof raw.max_borderline_cards === 'number' ? Math.min(50, Math.max(1, raw.max_borderline_cards)) : defaults.max_borderline_cards,
    };
  } catch (_) {
    return defaults;
  }
}

/** Classification Daphnée : rejeté = placement crypto (pousser une crypto/token), pas les liens d’affiliation exchange/app ni codes promo génériques. */
function classifyYoutubeByTranscript(title, summary, filterConfig) {
  const text = ((title || '') + ' ' + (summary || '')).toLowerCase();
  const len = (summary || '').trim().length;
  if (len < filterConfig.min_transcript_length) {
    return { classification: 'rejeté', reason: 'Contenu insuffisant (transcript trop court)' };
  }
  for (const phrase of filterConfig.shill_phrases) {
    if (text.includes(phrase.toLowerCase())) {
      return { classification: 'rejeté', reason: 'Placement crypto détecté (« ' + phrase + ' »)' };
    }
  }
  return { classification: 'borderline', reason: null };
}

function cleanVttToText(content) {
  if (!content || typeof content !== 'string') return '';
  const lines = content.split('\n');
  const textLines = [];
  const timestampRe = /^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t === 'WEBVTT' || /^\d+$/.test(t)) continue;
    if (timestampRe.test(t)) continue;
    if (t.startsWith('NOTE') || t.startsWith('STYLE')) continue;
    if (textLines.length && textLines[textLines.length - 1] === t) continue;
    textLines.push(t.replace(/<[^>]+>/g, ''));
  }
  return textLines.join(' ').trim();
}

function getYoutubeTranscriptViaYtDlp(url) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-transcript-'));
  try {
    execFileSync('yt-dlp', [
      '--write-subs', '--write-auto-subs', '--skip-download',
      '--sub-lang', 'en,en-US,en-GB', '--output', 'subs', url,
    ], { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024, cwd: tmpDir });
    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.vtt'));
    if (!files.length) return null;
    const content = fs.readFileSync(path.join(tmpDir, files[0]), 'utf8');
    return cleanVttToText(content);
  } catch (_) {
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

const INNERTUBE_KEY_FALLBACK = 'AIzaSyAO_FJ2SsMbLLRc0tPvZ8K_5CJfCL4nGkQ';

/** Récupère le transcript via l’API interne YouTube (Innertube) — sous-titres auto sans OAuth, sans clé API. */
async function getYoutubeTranscriptViaInnertube(videoId) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0';
  let playerData;
  try {
    const pr = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY_FALLBACK}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ua },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
        videoId,
      }),
    });
    if (!pr.ok) return null;
    playerData = await pr.json();
  } catch (_) { return null; }
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || !tracks.length) return null;
  const preferred = ['en', 'en-US', 'en-GB', 'a.en', 'fr'];
  const track = preferred.map((lang) => tracks.find((t) => (t.languageCode || '').toLowerCase() === lang)).find(Boolean) || tracks[0];
  const baseUrl = (track.baseUrl || '').trim();
  if (!baseUrl) return null;
  try {
    const cr = await fetch(baseUrl, { headers: { 'User-Agent': ua } });
    const body = await cr.text();
    if (!cr.ok || !body) return null;
    const decode = (s) => (s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    let captionText = '';
    if (body.trimStart().startsWith('{')) {
      try {
        const json = JSON.parse(body);
        const events = json.events || json.body || [];
        for (const e of events) {
          const segs = e.segs || e.s || [];
          for (const s of segs) {
            const t = (s.utf8 != null ? s.utf8 : s.t != null ? s.t : (typeof s === 'string' ? s : '')).trim();
            if (t && t !== '\\n') captionText += (captionText ? ' ' : '') + t;
          }
        }
      } catch (_) {}
    }
    if (!captionText && body.includes('<p ')) {
      const pMatches = body.matchAll(/<p\s[^>]*>([\s\S]*?)<\/p>/g);
      const parts = [...pMatches].map((m) => {
        const inner = m[1] || '';
        const segText = inner.replace(/<s[^>]*>([^<]*)<\/s>/g, '$1').replace(/<[^>]+>/g, '');
        return decode(segText).trim();
      }).filter(Boolean);
      captionText = parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    return (captionText && captionText.length > 0) ? captionText : null;
  } catch (_) { return null; }
}

async function getYoutubeTranscript(url) {
  if (!url || !url.includes('youtube.com')) return { transcript: null, error: 'URL invalide' };
  const videoId = (url.match(/[?&]v=([^&]+)/) || [])[1] || (url.match(/youtu\.be\/([^/?]+)/) || [])[1];
  if (!videoId) return { transcript: null, error: 'ID vidéo introuvable' };

  let text = await getYoutubeTranscriptViaInnertube(videoId);
  if (text && text.length > 0) return { transcript: text.slice(0, 800), error: null };

  if (fs.existsSync(YT_TRANSCRIPT_SCRIPT)) {
    try {
      const out = execSync(`python3 "${YT_TRANSCRIPT_SCRIPT}" "${url}"`, { encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
      const transcript = (out || '').trim();
      if (transcript.length > 0) return { transcript: transcript.slice(0, 800), error: null };
    } catch (_) {}
  }

  try {
    const { YoutubeTranscript } = require('youtube-transcript');
    const chunks = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = (chunks || []).map((c) => (c && c.text) || '').join(' ').trim();
    if (transcript.length > 0) return { transcript: transcript.slice(0, 800), error: null };
  } catch (_) {}

  const ytDlpText = getYoutubeTranscriptViaYtDlp(url);
  if (ytDlpText && ytDlpText.length > 0) return { transcript: ytDlpText.slice(0, 800), error: null };

  return { transcript: null, error: 'Sous-titres indisponibles pour cette vidéo' };
}

const { getCachedXPosts } = require('./x-posts-cache.js');

async function fetchXTrends() {
  const r = await getCachedXPosts();
  return { data: r.data, error: r.error };
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

/** Construit une vue clarifiée des situations par source + synthèse globale (pour dashboard et orchestrator). */
function buildClarifiedView(cards, xTrend) {
  const bySource = {};
  const xCard = cards.find((c) => c.source === 'x');
  if (xCard && xTrend && xTrend.themes && xTrend.themes.length) {
    bySource.x = `X : ${xTrend.themes.join(', ')}.`;
  } else if (xCard && xCard.summary) {
    bySource.x = 'X : ' + (xCard.summary.length > 120 ? xCard.summary.slice(0, 117) + '…' : xCard.summary);
  } else {
    bySource.x = 'X : aucune donnée.';
  }

  const ytCards = cards.filter((c) => c.source === 'youtube');
  if (ytCards.length > 0) {
    const titles = ytCards.slice(0, 5).map((c) => (c.title || '').toLowerCase());
    const keywords = [];
    if (titles.some((t) => t.includes('bitcoin') || t.includes('btc'))) keywords.push('Bitcoin');
    if (titles.some((t) => t.includes('warning') || t.includes('dump') || t.includes('panic'))) keywords.push('tension short-term');
    if (titles.some((t) => t.includes('etf') || t.includes('blackrock') || t.includes('institutional'))) keywords.push('ETF / institutionnel');
    if (titles.some((t) => t.includes('regulation') || t.includes('sec'))) keywords.push('régulation');
    if (titles.some((t) => t.includes('altcoin') || t.includes('alt coin'))) keywords.push('altcoins');
    if (!keywords.length) keywords.push('débats technique et actualités');
    bySource.youtube = `${ytCards.length} vidéo(s) : ${keywords.join(', ')}.`;
  } else {
    bySource.youtube = 'YouTube : aucune vidéo avec transcript.';
  }

  const macroCard = cards.find((c) => c.source === 'economic_calendar');
  if (macroCard && macroCard.summary) {
    bySource.macro = 'Macro : ' + (macroCard.summary.length > 150 ? macroCard.summary.slice(0, 147) + '…' : macroCard.summary);
  } else {
    bySource.macro = 'Macro : pas d’événement du jour.';
  }

  const cryptodailyCard = cards.find((c) => c.source === 'cryptodaily');
  if (cryptodailyCard && cryptodailyCard.summary) {
    bySource.cryptodaily = 'CryptoDaily : ' + (cryptodailyCard.summary.length > 100 ? cryptodailyCard.summary.slice(0, 97) + '…' : cryptodailyCard.summary);
  } else {
    bySource.cryptodaily = 'CryptoDaily : aucune actualité chargée.';
  }

  const redditCard = cards.find((c) => c.source === 'reddit');
  if (redditCard && redditCard.summary) {
    bySource.reddit = 'Reddit : ' + (redditCard.summary.length > 80 ? redditCard.summary.slice(0, 77) + '…' : redditCard.summary);
  } else {
    bySource.reddit = 'Reddit : pas de données.';
  }

  const situationSummary = [bySource.x, bySource.youtube, bySource.macro, bySource.cryptodaily, bySource.reddit].join(' ');
  return { situation_summary: situationSummary, situation_by_source: bySource };
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

/** Recherche YouTube (Daphnée) — YouTube Data API v3. order=date + publishedAfter = veille. Retourne [{ url, title }]. */
async function searchYouTubeVideos(apiKey, query, maxResults = 50, publishedAfterIso = null) {
  if (!apiKey || !String(apiKey).trim()) return [];
  const q = encodeURIComponent(query);
  let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=${Math.min(50, maxResults)}&q=${q}&key=${apiKey}`;
  if (publishedAfterIso) url += `&publishedAfter=${encodeURIComponent(publishedAfterIso)}`;
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

/** Recherche YouTube via package npm (Daphnée) — sans clé. Retourne [{ url, title }]. */
async function searchYouTubeViaNpm(query, maxResults = 50) {
  try {
    const youtubesearchapi = require('youtube-search-api');
    const result = await youtubesearchapi.GetListByKeyword(query, false, Math.min(50, maxResults));
    const items = result && Array.isArray(result.items) ? result.items : [];
    return items
      .filter((i) => i && i.id && (i.type === 'video' || !i.type))
      .map((i) => ({
        url: `https://www.youtube.com/watch?v=${i.id}`,
        title: (i.title || '').trim() || null,
      }));
  } catch (_) {
    return [];
  }
}

/** Recherche YouTube via RapidAPI (Daphnée) — sans clé Google. RAPIDAPI_KEY requis. Essaie plusieurs APIs si besoin. */
const RAPIDAPI_YT_CANDIDATES = [
  { host: 'youtube-search-results.p.rapidapi.com', path: (q) => `/youtube-search/?q=${q}` },
  { host: 'youtube-search1.p.rapidapi.com', path: (q) => `/?q=${q}` },
];
async function searchYouTubeViaRapidAPI(apiKey, query, maxResults = 5) {
  if (!apiKey || !String(apiKey).trim()) return [];
  const q = encodeURIComponent(query);
  const customHost = (process.env.INTEL_YOUTUBE_RAPIDAPI_HOST || '').trim();
  const toTry = customHost ? [{ host: customHost, path: (x) => `/youtube-search/?q=${x}` }] : RAPIDAPI_YT_CANDIDATES;
  for (const { host, path: pathFn } of toTry) {
    const url = `https://${host}${pathFn(q)}`;
    try {
      const res = await fetch(url, {
        headers: { 'X-RapidAPI-Key': apiKey, 'x-rapidapi-host': host },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items
        : (Array.isArray(data.results) ? data.results
          : (Array.isArray(data.result) ? data.result
            : (Array.isArray(data.contents) ? data.contents
              : (Array.isArray(data.data) ? data.data
                : (Array.isArray(data) ? data : [])))));
      const out = [];
      for (const i of items) {
        if (out.length >= maxResults) break;
        if (!i || typeof i !== 'object' && typeof i !== 'string') continue;
        let raw = i.link || i.url || i.href || (typeof i === 'string' && i.startsWith('http') ? i : null);
        if (!raw && i.videoId) raw = `https://www.youtube.com/watch?v=${i.videoId}`;
        if (!raw && i.id && (typeof i.id === 'string' || i.id.videoId)) raw = `https://www.youtube.com/watch?v=${typeof i.id === 'string' ? i.id : i.id.videoId}`;
        const title = (i.title || (i.snippet && i.snippet.title) || '').trim() || null;
        if (!raw || !String(raw).includes('youtube.com')) continue;
        raw = String(raw);
        if (raw.includes('/embed/')) raw = raw.replace(/.*\/embed\/([^/?]+).*/, 'https://www.youtube.com/watch?v=$1');
        if (!raw.includes('watch?v=') && raw.match(/[?&]v=([^&]+)/)) raw = 'https://www.youtube.com/watch?v=' + raw.match(/[?&]v=([^&]+)/)[1];
        if (!raw.includes('watch')) continue;
        out.push({ url: raw, title });
      }
      if (out.length) return out;
    } catch (_) {}
  }
  return [];
}

async function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const timestampUtc = now.toISOString();
  const cards = [];
  const scanStatus = {
    last_run_utc: timestampUtc,
    x: { status: 'ok', message: null },
    youtube: { status: 'ok', count_ok: 0, errors: [] },
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

  // Scrape quotidien : top 30–50 vidéos crypto (veille si API Google), transcript requis ; Daphnée pourra filtrer inutiles / placement.
  const publishedAfterVeille = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const youtubeApiKey = (process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const rapidApiKey = (process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '').trim();
  let youtubeList = [];
  if (youtubeApiKey) {
    const searched = await searchYouTubeVideos(youtubeApiKey, 'crypto bitcoin news', YOUTUBE_VIDEOS_PER_DAY, publishedAfterVeille);
    youtubeList = searched.map((e) => ({ url: e.url, title: e.title }));
    if (youtubeList.length) {
      scanStatus.youtube.source = 'youtube-api';
      console.log('Intel (Daphnée) :', youtubeList.length, 'vidéo(s) YouTube (veille, order=date).');
    }
  }
  if (!youtubeList.length) {
    const searched = await searchYouTubeViaNpm('crypto bitcoin news', YOUTUBE_VIDEOS_PER_DAY);
    youtubeList = searched.map((e) => ({ url: e.url, title: e.title }));
    if (youtubeList.length) {
      scanStatus.youtube.source = 'npm';
      console.log('Intel (Daphnée) :', youtubeList.length, 'vidéo(s) YouTube (recherche auto, sans clé).');
    }
  }
  if (!youtubeList.length && rapidApiKey) {
    const searched = await searchYouTubeViaRapidAPI(rapidApiKey, 'crypto bitcoin news', YOUTUBE_VIDEOS_PER_DAY);
    youtubeList = searched.map((e) => ({ url: e.url, title: e.title }));
    if (youtubeList.length) {
      scanStatus.youtube.source = 'rapidapi';
      console.log('Intel (Daphnée) :', youtubeList.length, 'vidéo(s) YouTube via RapidAPI.');
    }
  }
  if (!youtubeList.length) {
    youtubeList = loadYoutubeUrls().filter((e) => e && (e.url || (typeof e === 'string' && e.startsWith('http'))));
  }
  const youtubeFilterConfig = loadYoutubeFilterConfig();
  let borderlineCount = 0;
  for (let i = 0; i < youtubeList.length && scanStatus.youtube.count_ok < MAX_YOUTUBE_CARDS; i++) {
    const entry = typeof youtubeList[i] === 'string' ? { url: youtubeList[i], title: null } : youtubeList[i];
    const url = entry.url && entry.url.trim();
    if (!url || !url.includes('youtube.com')) continue;
    const result = await getYoutubeTranscript(url);
    const transcript = (result.transcript || '').trim();
    if (!transcript) {
      scanStatus.youtube.errors.push({ url: url.slice(0, 80), error: result.error || 'Pas de transcript' });
      continue;
    }
    const title = entry.title && entry.title.trim() ? entry.title.trim() : `Vidéo crypto ${scanStatus.youtube.count_ok + 1}`;
    const summary = transcript.length > 400 ? transcript.slice(0, 397) + '…' : transcript;
    const { classification, reason } = classifyYoutubeByTranscript(title, summary, youtubeFilterConfig);
    if (classification === 'borderline' && borderlineCount >= youtubeFilterConfig.max_borderline_cards) {
      continue;
    }
    if (classification === 'borderline') borderlineCount += 1;
    const card = {
      id: `yt-${date}-${i}-${Date.now()}`,
      source: 'youtube',
      title,
      summary,
      url,
      classification,
      date,
      timestamp_utc: timestampUtc,
    };
    if (reason) card.classification_reason = reason;
    cards.push(card);
    scanStatus.youtube.count_ok += 1;
  }
  if (scanStatus.youtube.errors.length && scanStatus.youtube.count_ok === 0) {
    scanStatus.youtube.status = 'error';
  } else if (scanStatus.youtube.errors.length) {
    scanStatus.youtube.status = 'partial';
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
        lines.push('Prévu vs publié : ' + recentWithActual.map((e) => {
          const name = (e.country ? e.country + ' ' : '') + (e.event || '');
          const pub = String(e.actual);
          const prevu = e.forecast != null && String(e.forecast).trim() !== '' ? String(e.forecast) : null;
          if (prevu) return name + ' → publié ' + pub + ', prévu ' + prevu;
          return name + ' → publié ' + pub;
        }).join(' ; '));
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

  // Carte CryptoDaily (actualités crypto) si cryptodaily_news.json existe et contient des items
  if (fs.existsSync(CRYPTODAILY_NEWS_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CRYPTODAILY_NEWS_PATH, 'utf8'));
      const items = Array.isArray(raw.items) ? raw.items : [];
      if (items.length > 0) {
        const summary = items.slice(0, 5).map((it) => it.title || '(sans titre)').join(' — ');
        cards.push({
          id: `cryptodaily-${date}-${Date.now()}`,
          source: 'cryptodaily',
          title: 'Actualités crypto (CryptoDaily)',
          summary: summary.length > 500 ? summary.slice(0, 497) + '…' : summary,
          url: 'https://rapidapi.com/cryptocurrency-news2/api/cryptodaily',
          classification: 'borderline',
          date,
          timestamp_utc: timestampUtc,
        });
      }
    } catch (_) {}
  }

  // Carte Reddit (subreddits similaires crypto) si reddit_intel.json existe
  if (fs.existsSync(REDDIT_INTEL_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(REDDIT_INTEL_PATH, 'utf8'));
      const subs = Array.isArray(raw.subreddits) ? raw.subreddits : [];
      if (subs.length > 0) {
        const names = subs.slice(0, 15).map((s) => s.display_name || s.title || '').filter(Boolean);
        cards.push({
          id: `reddit-${date}-${Date.now()}`,
          source: 'reddit',
          title: 'Reddit — subreddits crypto similaires',
          summary: names.join(', ') + (subs.length > 15 ? ' …' : ''),
          url: 'https://reddit.com/r/cryptocurrency',
          classification: 'borderline',
          date,
          timestamp_utc: timestampUtc,
        });
      }
    } catch (_) {}
  }

  if (!fs.existsSync(INTEL_DIR)) fs.mkdirSync(INTEL_DIR, { recursive: true });
  const clarified = buildClarifiedView(cards, xTrend);
  const output = {
    timestamp_utc: timestampUtc,
    date,
    situation_summary: clarified.situation_summary,
    situation_by_source: clarified.situation_by_source,
    cards,
  };
  fs.writeFileSync(TREND_CARDS_PATH, JSON.stringify(output, null, 2), 'utf8');
  fs.writeFileSync(SCAN_STATUS_PATH, JSON.stringify(scanStatus, null, 2), 'utf8');
  try {
    const { appendWire } = require('./wire-log.js');
    appendWire({
      from_agent: 'INTEL',
      to_agent: 'BROADCAST',
      type: 'SHARE_SIGNAL',
      context: { window: 'intel_trend_cards' },
      content_summary: clarified.situation_summary || `Trend Cards : ${cards.filter((c) => c.source === 'x').length} X, ${cards.filter((c) => c.source === 'youtube').length} YouTube.`,
      content_ref: 'data/dashboard/intel/trend_cards.json',
    });
  } catch (_) {}
  const ytLog = scanStatus.youtube.count_ok
    ? scanStatus.youtube.count_ok + ' carte(s) avec transcript'
    : (scanStatus.youtube.errors.length ? '0 (transcript requis — ' + scanStatus.youtube.errors.length + ' vidéo(s) sans sous-titres)' : '0');
  console.log('OK', TREND_CARDS_PATH, '| X:', scanStatus.x.status, '| YouTube:', ytLog);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
