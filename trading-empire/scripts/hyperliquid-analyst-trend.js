#!/usr/bin/env node
/**
 * TradeEmpire — Génère le rapport Hyperliquid Analyst (Eva) avec toutes les sources de contexte.
 * Lit commodities_meta.json + news_scan_report (Parvati) + trend_cards (Intel) + economic_calendar + RSS HIP-3 (Kitco, Yahoo Finance).
 * Écrit data/dashboard/hyperliquid_analyst_report.json pour le dashboard et l'agent LLM.
 * Usage: node scripts/hyperliquid-analyst-trend.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INTEL_DIR = path.join(ROOT, 'data', 'dashboard', 'intel');
const CONFIG_DIR = path.join(ROOT, 'dashboard', 'config');
const COMMODITIES_PATH = path.join(ROOT, 'data', 'hyperliquid', 'commodities_meta.json');
const REPORT_PATH = path.join(ROOT, 'data', 'dashboard', 'hyperliquid_analyst_report.json');
const NEWS_SCAN_PATH = path.join(INTEL_DIR, 'news_scan_report.json');
const TREND_CARDS_PATH = path.join(INTEL_DIR, 'trend_cards.json');
const ECONOMIC_CALENDAR_PATH = path.join(INTEL_DIR, 'economic_calendar.json');
const EVA_SOURCES_CONFIG = path.join(CONFIG_DIR, 'hyperliquid_analyst_sources.json');

const HIP3_MAX_ITEMS_PER_CATEGORY = 15;

function loadJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function loadEvaSourcesConfig() {
  return loadJson(EVA_SOURCES_CONFIG, { keywords_by_asset: {}, hip3_rss_feeds: {} });
}

/** Filtre les catalysts/titres par mots-clés (or, oil, macro, etc.). */
function filterRelevantTitles(catalysts, keywords) {
  if (!Array.isArray(catalysts) || !keywords.length) return [];
  const lower = (s) => (s || '').toLowerCase();
  const allKeywords = [...new Set(keywords.flatMap((k) => (typeof k === 'string' ? k : '').toLowerCase()).filter(Boolean))];
  return catalysts.filter((c) => {
    const text = typeof c === 'string' ? c : (c.title || c.summary || '');
    return allKeywords.some((kw) => lower(text).includes(kw));
  }).slice(0, 25);
}

/** Contexte à partir de Parvati (news_scan_report.json). */
function buildContextNews(config) {
  const data = loadJson(NEWS_SCAN_PATH);
  if (!data) return null;
  const catalysts = data.catalysts || [];
  const rssAggregate = data.rss_aggregate || [];
  const keywords = config.keywords_by_asset || {};
  const allKeywords = [
    ...(keywords.gold_metals || []),
    ...(keywords.oil_energy || []),
    ...(keywords.macro || []),
    'gold', 'oil', 'dollar', 'Fed', 'Hyperliquid', 'tokenized', 'Brent', 'OPEC', 'Iran',
  ];
  const relevant = filterRelevantTitles(catalysts, allKeywords);
  const fromRss = rssAggregate.filter((it) => {
    const t = (it.title || '').toLowerCase();
    return allKeywords.some((kw) => t.includes(kw.toLowerCase()));
  }).slice(0, 15).map((it) => ({ title: it.title, url: it.url, source: it.source }));
  return {
    source_file: 'intel/news_scan_report.json',
    catalysts_count: catalysts.length,
    relevant_titles: relevant.slice(0, 15),
    relevant_rss: fromRss.length ? fromRss : undefined,
    summary: relevant.length ? `Catalysts Parvati liés or/oil/macro : ${relevant.length} titre(s).` : 'Aucun catalyst filtré pour HIP-3.',
  };
}

/** Contexte à partir d'Intel (trend_cards.json). */
function buildContextIntel() {
  const data = loadJson(TREND_CARDS_PATH);
  if (!data) return null;
  const situation = data.situation_summary || '';
  const bySource = data.situation_by_source || {};
  const themes = [];
  if (bySource.x) themes.push(bySource.x);
  if (bySource.macro) themes.push(bySource.macro);
  return {
    source_file: 'intel/trend_cards.json',
    situation_summary: situation.slice(0, 300),
    themes: themes.length ? themes : [situation.slice(0, 150)],
  };
}

/** Contexte à partir du calendrier économique. */
function buildContextMacro() {
  const data = loadJson(ECONOMIC_CALENDAR_PATH);
  if (!data || !Array.isArray(data.events)) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const upcoming = data.events.filter((e) => {
    const d = e.date || '';
    return d === today || d === tomorrow;
  }).slice(0, 10).map((e) => ({ date: e.date, time_utc: e.time_utc, country: e.country, event: e.event, importance: e.importance }));
  return {
    source_file: 'intel/economic_calendar.json',
    today_events: upcoming,
    summary: upcoming.length ? `Prochains événements : ${upcoming.map((e) => e.event + ' (' + e.date + ' ' + (e.time_utc || '') + ')').join(' ; ')}.` : 'Aucun événement macro aujourd\'hui ou demain.',
  };
}

/** Parse RSS XML et retourne des items { title, url, source }. */
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
    for (let i = 0; i < Math.min(HIP3_MAX_ITEMS_PER_CATEGORY, titles.length, links.length); i++) {
      const t = titles[i];
      const u = links[i];
      if (!t || !u) continue;
      if (t === sourceName || /^(https?:\/\/[^/]+)\/?$/i.test(u)) continue;
      items.push({ title: t, url: u, source: sourceName });
    }
  } catch (_) {}
  return items;
}

async function fetchRssFeed(url, sourceName) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TradeEmpire-HyperliquidAnalyst/1.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, sourceName);
  } catch (_) {
    return [];
  }
}

/** Fetch tous les flux HIP-3 (Kitco, Yahoo Finance, etc.) depuis la config. */
async function fetchHip3Rss(config) {
  const feeds = config.hip3_rss_feeds || {};
  const out = { precious_metals: [], equities: [], energy: [] };
  for (const cat of ['precious_metals', 'equities', 'energy']) {
    const list = Array.isArray(feeds[cat]) ? feeds[cat] : [];
    const results = await Promise.all(list.map((f) => fetchRssFeed(f.url, f.name || cat)));
    out[cat] = results.flat().slice(0, HIP3_MAX_ITEMS_PER_CATEGORY);
  }
  return out;
}

async function main() {
  const now = new Date().toISOString();
  const evaConfig = loadEvaSourcesConfig();

  let commodities = [];
  try {
    const raw = loadJson(COMMODITIES_PATH);
    commodities = Array.isArray(raw?.commodities) ? raw.commodities : [];
  } catch (e) {
    const fallback = { timestamp_utc: now, source: 'hyperliquid_analyst_trend', error: e.message, symbols_analyzed: 0, recommendations: [], summary: 'Exécuter hyperliquid-commodities-scan.js puis ce script.' };
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    console.log('Rapport (erreur) écrit:', REPORT_PATH);
    process.exit(1);
  }

  const withData = commodities.filter((c) => c.markPx != null || c.openInterest != null);
  const mainDex = commodities.filter((c) => c.dexName === '(main)');
  const hip3 = commodities.filter((c) => c.dexName !== '(main)');
  const byDex = {};
  hip3.forEach((c) => {
    if (!byDex[c.dexName]) byDex[c.dexName] = [];
    byDex[c.dexName].push(c.name);
  });

  const trendSummary = [
    `Actifs suivis : ${commodities.length} (main: ${mainDex.length}, HIP-3: ${hip3.length}).`,
    `DEX HIP-3 : ${Object.keys(byDex).join(', ')}.`,
    `Exemples : ${['xyz:GOLD', 'xyz:SILVER', 'xyz:BRENTOIL', 'flx:OIL'].filter((s) => commodities.some((c) => c.name === s)).join(', ') || 'N/A'}.`,
  ].join(' ');

  const context_news = buildContextNews(evaConfig);
  const context_intel = buildContextIntel();
  const context_macro = buildContextMacro();
  const context_hip3_news = await fetchHip3Rss(evaConfig);

  const dataSources = ['commodities_meta.json'];
  if (context_news) dataSources.push('news_scan_report.json');
  if (context_intel) dataSources.push('trend_cards.json');
  if (context_macro) dataSources.push('economic_calendar.json');
  if (context_hip3_news.precious_metals?.length || context_hip3_news.equities?.length) dataSources.push('hip3_rss_feeds');

  const recommendations = [];
  if (mainDex.length > 0 && mainDex[0].markPx != null) {
    recommendations.push({
      symbol: mainDex[0].name,
      side: '—',
      reason: 'Premier actif main dex avec données (mark, funding). Contexte : ' + (context_news?.summary || context_hip3_news?.precious_metals?.length ? 'news + HIP-3 disponibles.' : 'à affiner par l\'agent.'),
      confidence: 'low',
      data_sources: dataSources,
    });
  }
  const gold = commodities.find((c) => /GOLD|XAU/i.test(c.name));
  if (gold) {
    recommendations.push({
      symbol: gold.name,
      side: '—',
      reason: 'Actif or tokenisé. ' + (context_news ? context_news.summary + ' ' : '') + (context_hip3_news.precious_metals?.length ? `Kitco: ${context_hip3_news.precious_metals.length} article(s).` : ''),
      confidence: 'low',
      data_sources: dataSources,
    });
  }
  const oil = commodities.find((c) => /OIL|BRENT|WTI/i.test(c.name));
  if (oil) {
    recommendations.push({
      symbol: oil.name,
      side: '—',
      reason: 'Actif pétrole tokenisé. ' + (context_news ? context_news.summary + ' ' : '') + (context_macro?.summary || ''),
      confidence: 'low',
      data_sources: dataSources,
    });
  }

  const report = {
    timestamp_utc: now,
    source: 'hyperliquid_analyst_trend',
    symbols_analyzed: commodities.length,
    commodities_count: commodities.length,
    main_dex_count: mainDex.length,
    hip3_count: hip3.length,
    dexes: Object.keys(byDex),
    first_trend: trendSummary,
    recommendations,
    summary: trendSummary,
    context_news: context_news || undefined,
    context_intel: context_intel || undefined,
    context_macro: context_macro || undefined,
    context_hip3_news: (context_hip3_news.precious_metals?.length || context_hip3_news.equities?.length || context_hip3_news.energy?.length) ? context_hip3_news : undefined,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  try {
    const { appendWire } = require('./wire-log.js');
    appendWire({
      from_agent: 'HYPERLIQUID_ANALYST',
      to_agent: 'BOSS',
      type: 'SHARE_SIGNAL',
      context: { window: 'hyperliquid_analyst_report' },
      content_summary: trendSummary + (context_news ? ' | ' + context_news.summary : '') + (context_hip3_news?.precious_metals?.length ? ` | Kitco: ${context_hip3_news.precious_metals.length}` : ''),
      content_ref: 'data/dashboard/hyperliquid_analyst_report.json',
    });
  } catch (_) {}
  console.log('Rapport tendance écrit:', REPORT_PATH);
  console.log('Contexte : news=', !!context_news, 'intel=', !!context_intel, 'macro=', !!context_macro, 'hip3_metals=', context_hip3_news.precious_metals?.length || 0, 'hip3_equities=', context_hip3_news.equities?.length || 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
