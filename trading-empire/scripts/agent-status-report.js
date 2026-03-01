#!/usr/bin/env node
/**
 * TradeEmpire — Rapport de situation par agent : compétences, connexions API, état.
 * Chaque agent teste ses dépendances (APIs, fichiers) et produit un rapport.
 * Usage: node scripts/agent-status-report.js
 * Sortie: data/dashboard/agent_status_report.json + data/reports/YYYY-MM-DD_agent_status.md
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_DASH = path.join(ROOT, 'data', 'dashboard');
const REPORTS_DIR = path.join(ROOT, 'data', 'reports');
const TECHNICALS_DIR = path.join(ROOT, 'data', 'signals', 'technicals');
const SMART_MONEY_DIR = path.join(ROOT, 'data', 'signals', 'smart_money');
const SENTIMENT_DIR = path.join(ROOT, 'data', 'signals', 'sentiment');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const RULES_DIR = path.join(ROOT, 'rules');
const SPEC_DIR = path.join(ROOT, 'dashboard', 'spec');
const CONFIG_DIR = path.join(ROOT, 'dashboard', 'config');

function now() {
  return new Date().toISOString();
}

async function checkBinanceKlines() {
  try {
    const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=1');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? { ok: true, candles: data.length } : { ok: false, message: 'Empty' };
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
}

async function checkBinanceFunding() {
  try {
    const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.symbol && data.lastFundingRate != null ? { ok: true } : { ok: false, message: 'Invalid response' };
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
}

async function checkHyperliquid() {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'vaultSummaries' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, count: Array.isArray(data) ? data.length : 0 };
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
}

async function checkTwitterAPI() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return { ok: false, message: 'X_BEARER_TOKEN non défini', configured: false };
  // Même requête que sentiment-scan.js pour cohérence (Twitter exige opérateurs valides)
  const query = encodeURIComponent('crypto OR bitcoin OR BTC -is:retweet lang:en');
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=10&tweet.fields=created_at,text`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.text();
    let data;
    try {
      data = body ? JSON.parse(body) : {};
    } catch (_) {
      data = {};
    }
    if (res.status === 401) return { ok: false, message: 'Token invalide ou expiré', configured: true };
    if (!res.ok) {
      const detail = data.detail || data.title || data.error || body.slice(0, 120);
      return { ok: false, message: `HTTP ${res.status}: ${detail}`, configured: true };
    }
    return { ok: true, configured: true, tweets: data.data?.length ?? 0 };
  } catch (e) {
    return { ok: false, message: e.message || String(e), configured: true };
  }
}

function checkDirReadable(dir, label) {
  if (!fs.existsSync(dir)) return { ok: false, message: `Dossier absent: ${dir}` };
  try {
    const files = fs.readdirSync(dir);
    return { ok: true, files: files.length, message: `${label} lisible (${files.length} entrée(s))` };
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
}

function checkFileReadable(filepath, label) {
  if (!fs.existsSync(filepath)) return { ok: false, message: `Fichier absent: ${path.basename(filepath)}` };
  try {
    fs.readFileSync(filepath, 'utf8');
    return { ok: true, message: `${label} lisible` };
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
}

function checkWritable(dir, label) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      return { ok: false, message: `Impossible de créer ${dir}` };
    }
  }
  const testFile = path.join(dir, '.status_write_test');
  try {
    fs.writeFileSync(testFile, now());
    fs.unlinkSync(testFile);
    return { ok: true, message: `${label} inscriptible` };
  } catch (e) {
    try { fs.unlinkSync(testFile); } catch (_) {}
    return { ok: false, message: e.message || String(e) };
  }
}

const LIGHT_MODE = process.argv.includes('--light');

function runScriptSuccess(scriptName, timeout = 15000) {
  if (LIGHT_MODE) return { ok: null, message: 'Non exécuté (mode --light)' };
  const scriptPath = path.join(__dirname, scriptName);
  try {
    execSync(`node "${scriptPath}"`, { encoding: 'utf8', cwd: ROOT, stdio: 'pipe', timeout });
    return { ok: true, message: 'Script exécuté avec succès' };
  } catch (e) {
    const msg = [e.stderr, e.stdout, e.message].filter(Boolean).join(' ').trim().slice(0, 120);
    return { ok: false, message: msg || 'Échec d’exécution' };
  }
}

async function runTechnicalsChecks() {
  const api = await checkBinanceKlines();
  const competency = runScriptSuccess('technicals-scan.js');
  const status = api.ok && (competency.ok === true || competency.ok === null) ? (competency.ok === null ? 'warning' : 'ok') : competency.ok === false ? 'error' : 'warning';
  return {
    status,
    api_connections: [
      { name: 'Binance (klines)', status: api.ok ? 'ok' : 'error', detail: api.ok ? 'OK' : api.message },
    ],
    competencies: [
      { name: 'technicals-scan.js', status: competency.ok === true ? 'ok' : competency.ok === null ? 'skip' : 'error', detail: competency.message },
    ],
    message: status === 'ok' ? 'APIs et script OK' : api.ok ? `Script: ${competency.message}` : `API: ${api.message}`,
  };
}

async function runSmartMoneyChecks() {
  const binance = await checkBinanceFunding();
  const hyperliquid = await checkHyperliquid();
  const competency = runScriptSuccess('smart-money-scan.js');
  const apis = [
    { name: 'Binance Futures (funding)', status: binance.ok ? 'ok' : 'error', detail: binance.ok ? 'OK' : binance.message },
    { name: 'Hyperliquid (vaultSummaries)', status: hyperliquid.ok ? 'ok' : 'warning', detail: hyperliquid.ok ? `OK (${hyperliquid.count})` : hyperliquid.message },
  ];
  const status = binance.ok && (competency.ok === true || competency.ok === null) ? (competency.ok === null ? 'warning' : 'ok') : competency.ok === false ? 'error' : 'warning';
  return {
    status,
    api_connections: apis,
    competencies: [{ name: 'smart-money-scan.js', status: competency.ok === true ? 'ok' : competency.ok === null ? 'skip' : 'error', detail: competency.message }],
    message: status === 'ok' ? 'APIs et script OK' : !binance.ok ? `Binance: ${binance.message}` : competency.message,
  };
}

async function runSentimentChecks() {
  const twitter = await checkTwitterAPI();
  const competency = runScriptSuccess('sentiment-scan.js');
  const apiStatus = twitter.configured === false ? 'warning' : twitter.ok ? 'ok' : 'error';
  const apis = [
    { name: 'Twitter/X API v2', status: apiStatus, detail: twitter.configured ? (twitter.ok ? `OK (${twitter.tweets} tweets)` : twitter.message) : 'Non configuré (X_BEARER_TOKEN)' },
  ];
  const status = (competency.ok === true || competency.ok === null) && (twitter.ok || !twitter.configured) ? (competency.ok === null ? 'warning' : 'ok') : competency.ok === false ? 'error' : 'warning';
  return {
    status,
    api_connections: apis,
    competencies: [{ name: 'sentiment-scan.js', status: competency.ok === true ? 'ok' : competency.ok === null ? 'skip' : 'error', detail: competency.message }],
    message: status === 'ok' ? 'Script OK' : !twitter.configured ? 'X non configuré (stub actif)' : twitter.message || competency.message,
  };
}

async function runOrchestratorChecks() {
  const d1 = checkDirReadable(TECHNICALS_DIR, 'technicals');
  const d2 = checkDirReadable(SMART_MONEY_DIR, 'smart_money');
  const d3 = checkDirReadable(SENTIMENT_DIR, 'sentiment');
  const d4 = checkDirReadable(IDEAS_DIR, 'ideas');
  const competency = runScriptSuccess('orchestrator-scan.js');
  const apis = [{ name: 'Fichiers locaux (signaux, idées)', status: d1.ok && d2.ok && d3.ok ? 'ok' : 'warning', detail: `technicals:${d1.ok} smart_money:${d2.ok} sentiment:${d3.ok} ideas:${d4.ok}` }];
  const status = d1.ok && d2.ok && d3.ok && d4.ok && (competency.ok === true || competency.ok === null) ? (competency.ok === null ? 'warning' : 'ok') : competency.ok === false ? 'error' : 'warning';
  return {
    status,
    api_connections: apis,
    competencies: [
      { name: 'Lecture signaux + production idées', status: competency.ok === true ? 'ok' : competency.ok === null ? 'skip' : 'error', detail: competency.message },
    ],
    message: status === 'ok' ? 'Dépendances et script OK' : competency.message,
  };
}

async function runRiskJournalChecks() {
  const rules = checkFileReadable(path.join(RULES_DIR, 'risk_rules.md'), 'risk_rules.md');
  const ideasDir = checkDirReadable(IDEAS_DIR, 'ideas');
  const competency = runScriptSuccess('risk-journal-scan.js');
  const status = rules.ok && ideasDir.ok && (competency.ok === true || competency.ok === null) ? (competency.ok === null ? 'warning' : 'ok') : competency.ok === false ? 'error' : 'warning';
  return {
    status,
    api_connections: [{ name: 'Fichiers locaux (idées, rules)', status: rules.ok && ideasDir.ok ? 'ok' : 'error', detail: rules.ok && ideasDir.ok ? 'OK' : 'Fichier ou dossier manquant' }],
    competencies: [{ name: 'risk-journal-scan.js', status: competency.ok === true ? 'ok' : competency.ok === null ? 'skip' : 'error', detail: competency.message }],
    message: status === 'ok' ? 'Règles et script OK' : competency.message,
  };
}

async function runBossChecks() {
  const dash = checkDirReadable(DATA_DASH, 'data/dashboard');
  const spec = checkWritable(SPEC_DIR, 'dashboard/spec');
  const config = checkWritable(CONFIG_DIR, 'dashboard/config');
  const competency = runScriptSuccess('boss-night.js');
  const status = dash.ok && spec.ok && config.ok && (competency.ok === true || competency.ok === null) ? (competency.ok === null ? 'warning' : 'ok') : competency.ok === false ? 'error' : 'warning';
  return {
    status,
    api_connections: [{ name: 'Dashboard (lecture/écriture)', status: dash.ok && spec.ok && config.ok ? 'ok' : 'error', detail: 'roadmap, spec, config' }],
    competencies: [{ name: 'boss-night.js', status: competency.ok === true ? 'ok' : competency.ok === null ? 'skip' : 'error', detail: competency.message }],
    message: status === 'ok' ? 'Contexte et script OK' : competency.message,
  };
}

async function runIntelChecks() {
  const twitter = await checkTwitterAPI();
  const intelDir = path.join(ROOT, 'data', 'dashboard', 'intel');
  const configPath = path.join(CONFIG_DIR, 'intel_youtube_urls.json');
  const configOk = fs.existsSync(configPath);
  const competency = runScriptSuccess('intel-scan.js');
  const apiStatus = twitter.configured === false ? 'warning' : twitter.ok ? 'ok' : 'error';
  const apis = [
    { name: 'X (Twitter API v2)', status: apiStatus, detail: twitter.configured ? (twitter.ok ? `OK (${twitter.tweets} tweets)` : twitter.message) : 'Non configuré' },
    { name: 'YouTube (youtube-watcher)', status: configOk ? 'ok' : 'warning', detail: configOk ? 'Config URLs présente' : 'intel_youtube_urls.json optionnel' },
  ];
  const status = (competency.ok === true || competency.ok === null) && (twitter.ok || !twitter.configured) ? (competency.ok === null ? 'warning' : 'ok') : competency.ok === false ? 'error' : 'warning';
  return {
    status,
    api_connections: apis,
    competencies: [{ name: 'intel-scan.js', status: competency.ok === true ? 'ok' : competency.ok === null ? 'skip' : 'error', detail: competency.message }],
    message: status === 'ok' ? 'Trend Cards X + YouTube OK' : !twitter.configured ? 'X non configuré' : twitter.message || competency.message,
  };
}

async function runChaseChecks() {
  const decisionsDir = path.join(ROOT, 'data', 'decisions');
  const ideasDir = path.join(ROOT, 'data', 'ideas');
  const trackerDir = path.join(ROOT, 'data', 'tracker');
  const decisionsOk = fs.existsSync(decisionsDir) && fs.statSync(decisionsDir).isDirectory();
  const ideasOk = fs.existsSync(ideasDir) && fs.statSync(ideasDir).isDirectory();
  const competency = runScriptSuccess('chase-tracker.js', 20000);
  const apis = [
    { name: 'data/decisions (APPROVED)', status: decisionsOk ? 'ok' : 'error', detail: decisionsOk ? 'Dossier lisible' : 'Absent' },
    { name: 'data/ideas', status: ideasOk ? 'ok' : 'error', detail: ideasOk ? 'Dossier lisible' : 'Absent' },
    { name: 'data/tracker (outcomes, post_mortem, feedback)', status: fs.existsSync(trackerDir) ? 'ok' : 'warning', detail: 'Sortie Chase' },
  ];
  const status = decisionsOk && ideasOk && (competency.ok === true || competency.ok === null) ? (competency.ok === null ? 'warning' : 'ok') : competency.ok === false ? 'error' : 'warning';
  return {
    status,
    api_connections: apis,
    competencies: [{ name: 'chase-tracker.js', status: competency.ok === true ? 'ok' : competency.ok === null ? 'skip' : 'error', detail: competency.message }],
    message: status === 'ok' ? 'Sync outcomes + post-mortem + feedback OK' : !decisionsOk || !ideasOk ? 'Dossiers decisions/ideas manquants' : competency.message,
  };
}

async function main() {
  const timestampUtc = now();
  if (!fs.existsSync(DATA_DASH)) fs.mkdirSync(DATA_DASH, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const report = {
    timestamp_utc: timestampUtc,
    agents: {
      TECHNICALS: await runTechnicalsChecks(),
      SMART_MONEY: await runSmartMoneyChecks(),
      SENTIMENT_X: await runSentimentChecks(),
      ORCHESTRATOR: await runOrchestratorChecks(),
      RISK_JOURNAL: await runRiskJournalChecks(),
      BOSS: await runBossChecks(),
      INTEL: await runIntelChecks(),
      CHASE: await runChaseChecks(),
    },
  };

  const jsonPath = path.join(DATA_DASH, 'agent_status_report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const date = timestampUtc.slice(0, 10);
  const mdLines = [
    `# Rapport de situation — Agents TradeEmpire`,
    ``,
    `**Date** : ${timestampUtc}`,
    ``,
    `| Agent | Statut | Connexions API | Compétences |`,
    `|-------|--------|----------------|-------------|`,
  ];
  for (const [name, r] of Object.entries(report.agents)) {
    const apis = r.api_connections.map((a) => `${a.name}: ${a.status}`).join(' ; ');
    const comps = r.competencies.map((c) => `${c.name}: ${c.status}`).join(' ; ');
    mdLines.push(`| ${name} | ${r.status} | ${apis} | ${comps} |`);
  }
  mdLines.push('');
  mdLines.push('## Détail par agent');
  for (const [name, r] of Object.entries(report.agents)) {
    mdLines.push(`### ${name}`);
    mdLines.push(`- **Message** : ${r.message}`);
    mdLines.push('- **Connexions** : ' + r.api_connections.map((a) => `${a.name} (${a.status}) — ${a.detail}`).join(' ; '));
    mdLines.push('- **Compétences** : ' + r.competencies.map((c) => `${c.name} (${c.status})`).join(' ; '));
    mdLines.push('');
  }
  const mdPath = path.join(REPORTS_DIR, `${date}_agent_status.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  console.log('Rapport de situation — Agents TradeEmpire');
  console.log(timestampUtc);
  console.log('');
  for (const [name, r] of Object.entries(report.agents)) {
    console.log(`${name}: ${r.status.toUpperCase()} — ${r.message}`);
  }
  console.log('');
  console.log('JSON:', jsonPath);
  console.log('Markdown:', mdPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
