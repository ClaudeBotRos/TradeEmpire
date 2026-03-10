#!/usr/bin/env node
/**
 * TradeEmpire — NEWS_SCAN (Parvati) : agrège RSS (config), optionnel JSON externe, CryptoDaily API en secours, X trending.
 * Priorité : 1) JSON externe (external_aggregate_path) si configuré et récent 2) agrégat RSS (news_rss_feeds.json) 3) CryptoDaily RapidAPI.
 * Autonome : ne dépend d'aucun autre repo.
 * Sortie: data/dashboard/intel/news_scan_report.json
 * Usage: node scripts/news-scan.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INTEL_DIR = path.join(ROOT, 'data', 'dashboard', 'intel');
const CONFIG_DIR = path.join(ROOT, 'dashboard', 'config');
const CRYPTODAILY_PATH = path.join(INTEL_DIR, 'cryptodaily_news.json');
const TREND_CARDS_PATH = path.join(INTEL_DIR, 'trend_cards.json');
const OUT_PATH = path.join(INTEL_DIR, 'news_scan_report.json');
const RSS_FEEDS_CONFIG = path.join(CONFIG_DIR, 'news_rss_feeds.json');

const COINDESK_RSS = 'https://www.coindesk.com/arc/outboundfeeds/rss/';
const COINDESK_MAX_ITEMS = 15;
const EXTERNAL_AGGREGATE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function loadRssFeedsConfig() {
  if (!fs.existsSync(RSS_FEEDS_CONFIG)) return null;
  try {
    return JSON.parse(fs.readFileSync(RSS_FEEDS_CONFIG, 'utf8'));
  } catch (_) {
    return null;
  }
}

/** Charge un JSON agrégé externe (optionnel) si le chemin est configuré et le fichier récent. */
function loadExternalAggregate(config) {
  const p = (config && (config.external_aggregate_path || config.granny_output_path)) || process.env.NEWS_AGGREGATE_JSON || '';
  const filePath = path.isAbsolute(p) ? p : path.join(ROOT, p);
  if (!p || !fs.existsSync(filePath)) return null;
  try {
    const stat = fs.statSync(filePath);
    if (Date.now() - stat.mtimeMs > EXTERNAL_AGGREGATE_MAX_AGE_MS) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const items = Array.isArray(raw.items) ? raw.items : (raw.articles || raw.entries || []);
    return items.slice(0, 50).map((it) => ({
      title: it.title || it.headline || '',
      url: it.url || it.link || null,
      date: it.date || it.publishedAt || null,
      source: it.source || it.feed || 'RSS',
    })).filter((it) => it.title);
  } catch (_) {
    return null;
  }
}

function parseRssXml(xml, sourceName) {
  const items = [];
  try {
    const titleRe = /<title>(?:<!\[CDATA\[([^\]]*)\]\]>|([^<]*))<\/title>/gi;
    const linkRe = /<link>(?:<!\[CDATA\[([^\]]*)\]\]>|([^<]*))<\/link>/gi;
    const titles = [];
    const links = [];
    let m;
    while ((m = titleRe.exec(xml)) !== null) titles.push((m[1] || m[2] || '').trim());
    while ((m = linkRe.exec(xml)) !== null) links.push((m[1] || m[2] || '').trim());
    for (let i = 0; i < Math.min(20, titles.length, links.length); i++) {
      if (titles[i] && links[i]) items.push({ title: titles[i], url: links[i], date: null, source: sourceName });
    }
  } catch (_) {}
  return items;
}

/** Agrège tous les flux RSS de la config (évite l'API CryptoDaily). */
async function fetchRssAggregate(config) {
  const feeds = config && Array.isArray(config.feeds) ? config.feeds : [];
  if (!feeds.length) return [];
  const results = await Promise.all(
    feeds.map(async (f) => {
      try {
        const res = await fetch(f.url, { headers: { 'User-Agent': 'TradeEmpire-NewsScan/1.0' } });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRssXml(xml, f.name || 'RSS');
      } catch (_) {
        return [];
      }
    })
  );
  return results.flat().slice(0, 50);
}

async function loadCryptoDaily() {
  if (fs.existsSync(CRYPTODAILY_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CRYPTODAILY_PATH, 'utf8'));
      const items = Array.isArray(raw.items) ? raw.items : [];
      return items.slice(0, 20).map((it) => ({ title: it.title || '', url: it.url || null, date: it.date || null, source: 'CryptoDaily' }));
    } catch (_) {}
  }
  try {
    execSync(`node "${path.join(__dirname, 'cryptodaily-news.js')}"`, { cwd: ROOT, stdio: 'pipe' });
    const raw = JSON.parse(fs.readFileSync(CRYPTODAILY_PATH, 'utf8'));
    const items = Array.isArray(raw.items) ? raw.items : [];
    return items.slice(0, 20).map((it) => ({ title: it.title || '', url: it.url || null, date: it.date || null, source: 'CryptoDaily' }));
  } catch (_) {
    return [];
  }
}

async function fetchCoindeskRss() {
  const items = [];
  try {
    const res = await fetch(COINDESK_RSS, { headers: { 'User-Agent': 'TradeEmpire-NewsScan/1.0' } });
    if (!res.ok) return items;
    const xml = await res.text();
    const titleMatches = xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g);
    const linkMatches = xml.matchAll(/<link>([^<]+)<\/link>/g);
    const titles = [...titleMatches].map((m) => m[1]).filter(Boolean);
    const links = [...linkMatches].map((m) => m[1]).filter(Boolean);
    for (let i = 0; i < Math.min(COINDESK_MAX_ITEMS, titles.length, links.length); i++) {
      if (titles[i] && links[i] && !links[i].includes('coindesk.com/consensus')) {
        items.push({ title: titles[i], url: links[i] });
      }
    }
  } catch (_) {}
  return items;
}

function loadXTrendingFromIntel() {
  if (!fs.existsSync(TREND_CARDS_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(TREND_CARDS_PATH, 'utf8'));
    const cards = raw.cards || raw.trend_cards || [];
    const xCard = cards.find((c) => c.source === 'x');
    if (xCard && (xCard.summary || xCard.themes)) {
      return {
        summary: xCard.summary || '',
        themes: xCard.themes || [],
      };
    }
  } catch (_) {}
  return null;
}

async function main() {
  if (!fs.existsSync(INTEL_DIR)) fs.mkdirSync(INTEL_DIR, { recursive: true });

  const rssConfig = loadRssFeedsConfig();
  const minToSkipApi = (rssConfig && typeof rssConfig.min_items_to_skip_api === 'number') ? rssConfig.min_items_to_skip_api : 5;
  const useRssFirst = rssConfig && rssConfig.use_rss_first !== false;

  let cryptodaily = [];
  let coindesk = [];
  let rss_aggregate = [];
  let api_skipped = false;

  const externalItems = loadExternalAggregate(rssConfig);
  if (externalItems && externalItems.length >= minToSkipApi) {
    rss_aggregate = externalItems;
    api_skipped = true;
  } else if (useRssFirst) {
    const rssItems = await fetchRssAggregate(rssConfig);
    if (rssItems.length >= minToSkipApi) {
      rss_aggregate = rssItems;
      api_skipped = true;
    }
  }

  if (!api_skipped) {
    cryptodaily = await loadCryptoDaily();
    coindesk = await fetchCoindeskRss();
  } else {
    coindesk = rss_aggregate.filter((i) => (i.source || '').toLowerCase() === 'coindesk').map((i) => ({ title: i.title, url: i.url }));
  }

  const xTrending = loadXTrendingFromIntel();

  const catalysts = [];
  if (rss_aggregate.length) {
    for (const it of rss_aggregate.slice(0, 25)) {
      if (it.title) catalysts.push(`[${it.source || 'RSS'}] ${it.title}`);
    }
  } else {
    for (const it of cryptodaily) {
      if (it.title) catalysts.push(`[CryptoDaily] ${it.title}`);
    }
    for (const it of coindesk.slice(0, 10)) {
      if (it.title) catalysts.push(`[Coindesk] ${it.title}`);
    }
  }
  if (xTrending && xTrending.themes && xTrending.themes.length) {
    catalysts.push(`[X] ${xTrending.themes.join(', ')}`);
  } else if (xTrending && xTrending.summary) {
    catalysts.push(`[X] ${xTrending.summary.slice(0, 200)}`);
  }

  const payload = {
    timestamp_utc: new Date().toISOString(),
    source: api_skipped ? 'rss_aggregate' : 'cryptodaily_api',
    cryptodaily: cryptodaily.length ? cryptodaily : [],
    coindesk: coindesk.length ? coindesk : [],
    rss_aggregate: rss_aggregate.length ? rss_aggregate : undefined,
    x_trending: xTrending || null,
    catalysts,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  const srcLog = api_skipped ? `RSS: ${rss_aggregate.length} (API évitée)` : `CryptoDaily: ${cryptodaily.length}`;
  console.log('OK', OUT_PATH, '|', srcLog, '| Coindesk:', coindesk.length, '| catalysts:', catalysts.length);

  try {
    const { appendWire } = require('./wire-log.js');
    appendWire({
      from_agent: 'NEWS_SCAN',
      to_agent: 'BOSS',
      type: 'SHARE_SIGNAL',
      context: { window: 'news_scan' },
      content_summary: `Parvati : ${catalysts.length} catalyst(s) (${api_skipped ? 'RSS agrégé' : 'CryptoDaily'}, Coindesk, X).`,
      content_ref: 'data/dashboard/intel/news_scan_report.json',
    });
  } catch (_) {}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
