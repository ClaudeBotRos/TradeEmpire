#!/usr/bin/env node
/**
 * TradeEmpire — Opportunity Scout : scanne paires / timeframes / sources pour proposer des idées de diversification.
 * Écrit data/dashboard/scout_proposals.json (consommable par BOSS vision ou brief matin).
 * Si des propositions intéressantes : envoie un rapport court sur WhatsApp (file notify-user-whatsapp).
 * Usage: node scripts/opportunity-scout.js [--timeframes 1h,4h,1D] [--no-whatsapp]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const WATCHLIST_PATH = path.join(ROOT, 'data', 'dashboard', 'watchlist.json');
const TECHNICALS_DIR = path.join(ROOT, 'data', 'signals', 'technicals');
const NICHES_DIR = path.join(ROOT, 'data', 'dashboard', 'niches');
const TREND_CARDS_PATH = path.join(ROOT, 'data', 'dashboard', 'intel', 'trend_cards.json');
const SCOUT_OUTPUT_PATH = path.join(ROOT, 'data', 'dashboard', 'scout_proposals.json');

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];
const COMMON_EXTRA_PAIRS = ['BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'AVAXUSDT', 'LINKUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'ADAUSDT', 'MATICUSDT', 'DOTUSDT', 'ATOMUSDT', 'LTCUSDT', 'NEARUSDT', 'INJUSDT', 'TIAUSDT', 'APTUSDT', 'FILUSDT', 'STXUSDT'];

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_PATH)) return DEFAULT_SYMBOLS;
  try {
    const data = JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
    return Array.isArray(data.symbols) ? data.symbols : DEFAULT_SYMBOLS;
  } catch (_) {
    return DEFAULT_SYMBOLS;
  }
}

function parseTimeframesArg() {
  const idx = process.argv.indexOf('--timeframes');
  if (idx === -1 || !process.argv[idx + 1]) return ['4h'];
  return process.argv[idx + 1].split(',').map((t) => t.trim()).filter(Boolean);
}

/** Derniers signaux techniques par symbole et par timeframe. */
function loadLatestTechnicalsBySymbolAndTf() {
  if (!fs.existsSync(TECHNICALS_DIR)) return {};
  const files = fs.readdirSync(TECHNICALS_DIR).filter((f) => f.endsWith('.json'));
  const byKey = {};
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(TECHNICALS_DIR, f), 'utf8'));
      const sym = data.symbol || (f.match(/^([A-Z0-9]+)_/) && f.match(/^([A-Z0-9]+)_/)[1]);
      const tf = data.timeframe || '4h';
      if (!sym) continue;
      const key = `${sym}_${tf}`;
      const ts = (data.timestamp_utc || '').replace(/[-:T.Z]/g, '');
      if (!byKey[key] || (ts && (!byKey[key].timestamp_utc || ts > (byKey[key].timestamp_utc || '').replace(/[-:T.Z]/g, '')))) {
        byKey[key] = { ...data, symbol: sym, timeframe: tf };
      }
    } catch (_) {}
  }
  return byKey;
}

/** Symboles présents dans les niches (fiches scorées). */
function loadSymbolsFromNiches() {
  if (!fs.existsSync(NICHES_DIR)) return [];
  const files = fs.readdirSync(NICHES_DIR).filter((f) => f.endsWith('.json'));
  const symbols = new Set();
  for (const f of files) {
    const m = f.match(/^idea_([A-Z0-9]+)_/i);
    if (m) symbols.add(m[1].toUpperCase());
  }
  return Array.from(symbols);
}

function loadTrendCards() {
  if (!fs.existsSync(TREND_CARDS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(TREND_CARDS_PATH, 'utf8'));
  } catch (_) {
    return null;
  }
}

function main() {
  const timeframes = parseTimeframesArg();
  const watchlist = loadWatchlist();
  const technicalsByKey = loadLatestTechnicalsBySymbolAndTf();
  const symbolsInNiches = loadSymbolsFromNiches();
  const trendCards = loadTrendCards();

  const proposals = [];
  const watchSet = new Set(watchlist.map((s) => s.toUpperCase()));

  // 1) Paires dans niches mais pas dans watchlist → candidats à ajouter
  for (const sym of symbolsInNiches) {
    if (watchSet.has(sym)) continue;
    proposals.push({
      symbol: sym,
      timeframe: null,
      reason: 'Présent dans les fiches niches (scorées) mais absent de la watchlist.',
      source: 'niches',
    });
  }

  // 2) Paires communes (liste étendue) non présentes dans watchlist ni niches
  for (const sym of COMMON_EXTRA_PAIRS) {
    if (watchSet.has(sym) || symbolsInNiches.includes(sym)) continue;
    const hasSignal = Object.keys(technicalsByKey).some((k) => k.startsWith(sym + '_'));
    proposals.push({
      symbol: sym,
      timeframe: null,
      reason: hasSignal ? 'Signal technique existant pour cette paire.' : 'Paire courante USDT-M non couverte.',
      source: 'watchlist_extension',
    });
  }

  // 3) Timeframes sous-exploités : symboles de la watchlist avec signaux seulement sur un TF
  const tfCountBySymbol = {};
  for (const key of Object.keys(technicalsByKey)) {
    const [sym] = key.split('_');
    if (!tfCountBySymbol[sym]) tfCountBySymbol[sym] = new Set();
    tfCountBySymbol[sym].add(technicalsByKey[key].timeframe || '4h');
  }
  for (const sym of watchlist) {
    const s = sym.toUpperCase();
    const tfs = tfCountBySymbol[s] ? Array.from(tfCountBySymbol[s]) : [];
    for (const tf of timeframes) {
      if (tfs.includes(tf)) continue;
      proposals.push({
        symbol: s,
        timeframe: tf,
        reason: `Aucun signal technique récent sur ${tf} ; diversification timeframe.`,
        source: 'timeframe',
      });
    }
  }

  // 4) Résumé narrative Intel si dispo
  let narrativeHint = '';
  if (trendCards && (trendCards.situation_summary || trendCards.narrative_summary)) {
    narrativeHint = (trendCards.situation_summary || trendCards.narrative_summary || '').slice(0, 200);
  }

  const output = {
    timestamp_utc: new Date().toISOString(),
    current_watchlist: watchlist,
    timeframes_scanned: timeframes,
    proposals,
    summary: `Scout : ${proposals.length} proposition(s) (paires hors watchlist, timeframes supplémentaires). ${narrativeHint ? 'Intel : ' + narrativeHint : ''}`,
  };

  const dashDir = path.dirname(SCOUT_OUTPUT_PATH);
  if (!fs.existsSync(dashDir)) fs.mkdirSync(dashDir, { recursive: true });
  fs.writeFileSync(SCOUT_OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('Scout proposals written to', SCOUT_OUTPUT_PATH);

  try {
    const { appendWire } = require('./wire-log.js');
    appendWire({
      from_agent: 'OPPORTUNITY_SCOUT',
      to_agent: 'BOSS',
      type: 'SHARE_SIGNAL',
      context: { window: 'scout_proposals' },
      content_summary: `${proposals.length} proposition(s) de diversification. Détail : ${SCOUT_OUTPUT_PATH}.`,
      content_ref: 'data/dashboard/scout_proposals.json',
    });
  } catch (_) {}

  // WhatsApp : envoi du rapport uniquement quand il y a des propositions intéressantes
  const minProposalsForWhatsApp = parseInt(process.env.SCOUT_MIN_PROPOSALS_WHATSAPP || '1', 10);
  const noWhatsApp = process.argv.includes('--no-whatsapp');
  if (!noWhatsApp && proposals.length >= minProposalsForWhatsApp) {
    const symbolsList = [...new Set(proposals.map((p) => p.symbol.replace('USDT', '')))].slice(0, 8).join(', ');
    const msg = `${proposals.length} proposition(s) de diversification : ${symbolsList}${proposals.length > 8 ? '…' : ''}. Détail dashboard / scout_proposals.`;
    try {
      execSync(`node "${path.join(__dirname, 'notify-user-whatsapp.js')}"`, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, AGENT_ID: 'opportunity_scout', NOTIFY_MESSAGE: msg },
      });
      console.log('Scout: rapport mis en file WhatsApp.');
    } catch (e) {
      console.warn('Scout: envoi WhatsApp en file ignoré:', e.message || e);
    }
  }

  console.log(JSON.stringify({ ok: true, proposals_count: proposals.length, file: SCOUT_OUTPUT_PATH }));
}

main();
