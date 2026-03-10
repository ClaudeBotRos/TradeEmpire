#!/usr/bin/env node
/**
 * TradeEmpire — Serveur dashboard minimal (MVP).
 * Sert les fichiers statiques depuis dashboard/ et expose GET /api/signals/technicals.
 * Usage: node scripts/dashboard-server.js [PORT]
 * Default port: 3579
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.argv[2] || '3579', 10);
const DASHBOARD_DIR = path.join(ROOT, 'dashboard');
const AGENTS_DIR = path.join(ROOT, 'agents');
const DATA = {
  technicals: path.join(ROOT, 'data', 'signals', 'technicals'),
  smart_money: path.join(ROOT, 'data', 'signals', 'smart_money'),
  sentiment: path.join(ROOT, 'data', 'signals', 'sentiment'),
  ideas: path.join(ROOT, 'data', 'ideas'),
  decisions: path.join(ROOT, 'data', 'decisions'),
  journal: path.join(ROOT, 'data', 'journal'),
  dashboard: path.join(ROOT, 'data', 'dashboard'),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function readJsonDir(dir, sortBy = 'timestamp_utc') {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const list = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const data = JSON.parse(raw);
      list.push({ file: f, ...data });
    } catch (_) {}
  }
  if (sortBy) list.sort((a, b) => (b[sortBy] || '').localeCompare(a[sortBy] || ''));
  return list;
}

function readJournal(date) {
  const filepath = path.join(DATA.journal, `${date}.md`);
  if (!fs.existsSync(filepath)) return null;
  return fs.readFileSync(filepath, 'utf8');
}

function readJournalBrief(date) {
  const filepath = path.join(DATA.journal, `${date}_brief.md`);
  if (!fs.existsSync(filepath)) return null;
  return fs.readFileSync(filepath, 'utf8');
}

function readJsonFile(dir, filename) {
  const filepath = path.join(dir, filename);
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/** Retourne le répertoire data/dashboard utilisable (existe et contient au moins un fichier connu). */
function resolveDashboardDataDir() {
  const candidates = [
    DATA.dashboard,
    path.join(process.cwd(), 'data', 'dashboard'),
    path.join(process.cwd(), 'workspace', 'TradeEmpire', 'trading-empire', 'data', 'dashboard'),
  ];
  let dir = __dirname;
  for (let i = 0; i < 10 && dir !== path.dirname(dir); i++) {
    candidates.push(path.join(dir, 'data', 'dashboard'));
    dir = path.dirname(dir);
  }
  const probes = ['yield_farmer_report.json', 'uniswap_v3_arbitrum_pools.json', 'roadmap.json', 'hyperliquid_analyst_report.json'];
  for (const d of candidates) {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
    for (const probe of probes) {
      if (fs.existsSync(path.join(d, probe))) return d;
    }
  }
  return DATA.dashboard;
}

const RESOLVED_DASHBOARD_DIR = resolveDashboardDataDir();

const DATA_DASHBOARD_BY_SCRIPT = path.join(__dirname, '..', 'data', 'dashboard');

/** Lit un JSON depuis data/dashboard (plusieurs chemins possibles). */
function readDashboardJson(filename) {
  let out = readJsonFile(DATA_DASHBOARD_BY_SCRIPT, filename);
  if (out != null) return out;
  out = readJsonFile(RESOLVED_DASHBOARD_DIR, filename);
  if (out != null) return out;
  out = readJsonFile(DATA.dashboard, filename);
  if (out != null) return out;
  const altPaths = [
    path.join(process.cwd(), 'data', 'dashboard', filename),
    path.join(process.cwd(), 'workspace', 'TradeEmpire', 'trading-empire', 'data', 'dashboard', filename),
  ];
  for (const p of altPaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (_) {}
    }
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const KANBAN_PATH = path.join(DATA.dashboard, 'kanban.json');

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname = (parsed.pathname || '/').replace(/\/$/, '') || '/';
  const method = (req.method || 'GET').toUpperCase();

  const corsJson = () => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
  };

  if (pathname === '/favicon.ico') {
    res.writeHead(204, { 'Content-Length': '0' });
    res.end();
    return;
  }

  const cors = () => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
  };
  if (pathname === '/api/signals/technicals') {
    cors();
    res.end(JSON.stringify(readJsonDir(DATA.technicals)));
    return;
  }
  if (pathname === '/api/signals/smart_money') {
    cors();
    res.end(JSON.stringify(readJsonDir(DATA.smart_money)));
    return;
  }
  if (pathname === '/api/smart_money/holders') {
    cors();
    const holdersPath = path.join(DATA.smart_money, 'dexscreener_holders.json');
    if (!fs.existsSync(holdersPath)) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'dexscreener_holders.json absent. Exécuter node scripts/dexscreener-top-traders.js <WALLET_URL>.' }));
      return;
    }
    try {
      const raw = fs.readFileSync(holdersPath, 'utf8');
      res.end(raw);
    } catch (_) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Erreur lecture dexscreener_holders.json' }));
    }
    return;
  }
  if (pathname === '/api/smart_money/leaderboard') {
    cors();
    const leaderboardPath = path.join(DATA.smart_money, 'binance_copy_leaderboard.json');
    if (!fs.existsSync(leaderboardPath)) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'binance_copy_leaderboard.json absent. Exécuter node scripts/binance-copy-leaderboard.js.' }));
      return;
    }
    try {
      const raw = fs.readFileSync(leaderboardPath, 'utf8');
      res.end(raw);
    } catch (_) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Erreur lecture binance_copy_leaderboard.json' }));
    }
    return;
  }
  if (pathname === '/api/signals/sentiment') {
    cors();
    res.end(JSON.stringify(readJsonDir(DATA.sentiment)));
    return;
  }
  if (pathname === '/api/ideas') {
    cors();
    res.end(JSON.stringify(readJsonDir(DATA.ideas)));
    return;
  }
  if (pathname === '/api/decisions') {
    cors();
    res.end(JSON.stringify(readJsonDir(DATA.decisions)));
    return;
  }
  const journalBriefMatch = pathname.match(/^\/api\/journal\/(\d{4}-\d{2}-\d{2})\/brief$/);
  if (journalBriefMatch) {
    const body = readJournalBrief(journalBriefMatch[1]);
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (body === null) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.end(body);
    }
    return;
  }
  const journalMatch = pathname.match(/^\/api\/journal\/(\d{4}-\d{2}-\d{2})$/);
  if (journalMatch) {
    const body = readJournal(journalMatch[1]);
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (body === null) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not found');
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.end(body);
    }
    return;
  }

  if (pathname === '/api/agent_status_report') {
    cors();
    const data = readJsonFile(DATA.dashboard, 'agent_status_report.json') || null;
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/roadmap') {
    cors();
    const data = readJsonFile(DATA.dashboard, 'roadmap.json') || { steps: [], current_step_id: null };
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/team') {
    cors();
    const teamPath = path.join(DASHBOARD_DIR, 'config', 'team.json');
    const data = fs.existsSync(teamPath) ? JSON.parse(fs.readFileSync(teamPath, 'utf8')) : [];
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/wire') {
    cors();
    const data = readJsonFile(DATA.dashboard, 'agent_exchanges.json') || [];
    res.end(JSON.stringify(Array.isArray(data) ? data : []));
    return;
  }
  const wireContentMatch = pathname.match(/^\/api\/wire-content$/);
  if (wireContentMatch && method === 'GET') {
    const pathParam = (parsed.query && parsed.query.path) || '';
    const safePath = pathParam.replace(/^\.+\//, '').replace(/\/\.+/g, '');
    if (!safePath.startsWith('data/') || safePath.includes('..')) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Chemin non autorisé' }));
      return;
    }
    const filePath = path.join(ROOT, safePath);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Fichier introuvable' }));
      return;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      cors();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ path: safePath, content: raw }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (pathname === '/api/kanban') {
    cors();
    const data = readJsonFile(DATA.dashboard, 'kanban.json') || { columns: [], tasks: [] };
    res.end(JSON.stringify(data));
    return;
  }
  if (method === 'POST' && pathname === '/api/kanban/task') {
    readBody(req).then((bodyStr) => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const kanban = readJsonFile(DATA.dashboard, 'kanban.json') || { columns: [], tasks: [] };
        if (!kanban.tasks) kanban.tasks = [];
        const id = 'task-' + Date.now();
        const task = { id, title: body.title || 'Sans titre', columnId: body.columnId || 'todo' };
        if (body.description != null) task.description = body.description;
        if (body.source != null) task.source = body.source;
        if (body.type != null) task.type = body.type;
        kanban.tasks.push(task);
        fs.writeFileSync(KANBAN_PATH, JSON.stringify(kanban, null, 2), 'utf8');
        corsJson();
        res.end(JSON.stringify(kanban));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
      }
    }).catch(() => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Bad request' }));
    });
    return;
  }
  if (method === 'PATCH' && pathname.startsWith('/api/kanban/task/')) {
    const taskId = pathname.replace(/^\/api\/kanban\/task\//, '').replace(/\/$/, '');
    if (!taskId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing task id' }));
      return;
    }
    readBody(req).then((bodyStr) => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const kanban = readJsonFile(DATA.dashboard, 'kanban.json') || { columns: [], tasks: [] };
        if (!kanban.tasks) kanban.tasks = [];
        const task = kanban.tasks.find((t) => t.id === taskId);
        if (!task) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Task not found' }));
          return;
        }
        if (body.columnId != null) task.columnId = body.columnId;
        if (body.title != null) task.title = body.title;
        fs.writeFileSync(KANBAN_PATH, JSON.stringify(kanban, null, 2), 'utf8');
        corsJson();
        res.end(JSON.stringify(kanban));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
      }
    }).catch(() => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Bad request' }));
    });
    return;
  }
  if (method === 'DELETE' && pathname.startsWith('/api/kanban/task/')) {
    const taskId = pathname.replace(/^\/api\/kanban\/task\//, '').replace(/\/$/, '');
    if (!taskId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing task id' }));
      return;
    }
    try {
      const kanban = readJsonFile(DATA.dashboard, 'kanban.json') || { columns: [], tasks: [] };
      if (!kanban.tasks) kanban.tasks = [];
      const before = kanban.tasks.length;
      kanban.tasks = kanban.tasks.filter((t) => t.id !== taskId);
      if (kanban.tasks.length === before) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      fs.writeFileSync(KANBAN_PATH, JSON.stringify(kanban, null, 2), 'utf8');
      corsJson();
      res.end(JSON.stringify(kanban));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (pathname === '/api/api_requests') {
    cors();
    const requests = readJsonFile(DATA.dashboard, 'api_requests.json') || [];
    const list = Array.isArray(requests) ? requests : [];
    const priorityPath = path.join(DASHBOARD_DIR, 'config', 'api_needs_priority.md');
    let priority_md = '';
    if (fs.existsSync(priorityPath)) {
      try {
        priority_md = fs.readFileSync(priorityPath, 'utf8');
      } catch (_) {}
    }
    res.end(JSON.stringify({ requests: list, priority_md }));
    return;
  }
  if (pathname === '/api/costs') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    cors();
    (async () => {
      let data = readDashboardJson('costs.json') || {};
      const hasGains =
        (typeof (data.gains && data.gains.total_gains_usd) === 'number' && !Number.isNaN(data.gains.total_gains_usd)) ||
        (typeof (data.trading && data.trading.realized_pnl_usd) === 'number' && !Number.isNaN(data.trading.realized_pnl_usd));
      if (!hasGains) {
        let filled = false;
        try {
          const aster = require(path.join(__dirname, 'aster-client.js'));
          const realized = await aster.getRealizedPnlUsd();
          if (typeof realized === 'number' && !Number.isNaN(realized)) {
            data = JSON.parse(JSON.stringify(data));
            if (!data.trading) data.trading = {};
            if (!data.gains) data.gains = {};
            data.trading.realized_pnl_usd = realized;
            data.gains.trading_realized_pnl_usd = realized;
            data.gains_source = 'aster';
            filled = true;
          }
        } catch (_) {}
        if (!filled) {
          const balance = readDashboardJson('executor_balance.json');
          const wallet = balance && (balance.total_wallet_balance_usdt != null || balance.available_balance_usdt != null)
            ? parseFloat(balance.total_wallet_balance_usdt ?? balance.available_balance_usdt ?? 0)
            : NaN;
          if (Number.isFinite(wallet)) {
            data = JSON.parse(JSON.stringify(data));
            if (!data.gains) data.gains = {};
            data.gains.total_gains_usd = wallet;
            data.gains_source = 'executor_balance';
          } else {
            data = JSON.parse(JSON.stringify(data));
            data._gains_fetch_error = 'Solde ASTER non dispo (exécuter executor-run.js ou vérifier executor_balance.json).';
          }
        }
      }
      try {
        res.end(JSON.stringify(data));
      } catch (_) {}
    })();
    return;
  }
  if (pathname === '/api/execution_config') {
    const configPath = path.join(DATA.dashboard, 'execution_config.json');
    const defaultConfig = { real_mode: false, notional_usd: 5, notional_by_symbol: {}, updated_at: null };
    if (method === 'GET') {
      cors();
      const data = readJsonFile(DATA.dashboard, 'execution_config.json') || defaultConfig;
      if (!data.notional_by_symbol) data.notional_by_symbol = {};
      res.end(JSON.stringify(data));
      return;
    }
    if (method === 'PATCH') {
      readBody(req).then((bodyStr) => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          let data = { ...defaultConfig };
          if (fs.existsSync(configPath)) {
            try {
              const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              data = { ...defaultConfig, ...existing };
            } catch (_) {}
          }
          if (typeof body.real_mode === 'boolean') data.real_mode = body.real_mode;
          if (typeof body.notional_usd === 'number' && body.notional_usd > 0) data.notional_usd = body.notional_usd;
          if (body.notional_by_symbol && typeof body.notional_by_symbol === 'object') data.notional_by_symbol = body.notional_by_symbol;
          data.updated_at = new Date().toISOString();
          fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
          corsJson();
          res.end(JSON.stringify(data));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: e.message }));
        }
      }).catch(() => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Bad request' }));
      });
      return;
    }
  }
  if (pathname === '/api/executed_orders_open' || (pathname === '/api/executed_orders' && parsed.query && parsed.query.open === '1')) {
    cors();
    (async () => {
      try {
        const { runSync } = require(path.join(__dirname, 'sync-executed-orders-with-aster.js'));
        await runSync();
      } catch (_) {}
      const data = readJsonFile(DATA.dashboard, 'executed_orders.json') || [];
      const list = Array.isArray(data) ? data : [];
      const out = list.filter((e) => e.closed_on_aster !== true);
      res.end(JSON.stringify(out));
    })();
    return;
  }
  if (pathname === '/api/executed_orders') {
    cors();
    const data = readJsonFile(DATA.dashboard, 'executed_orders.json') || [];
    res.end(JSON.stringify(Array.isArray(data) ? data : []));
    return;
  }
  if (pathname === '/api/executor_balance') {
    cors();
    const data = readJsonFile(DATA.dashboard, 'executor_balance.json') || null;
    res.end(JSON.stringify(data || { available_balance_usdt: null, total_wallet_balance_usdt: null, updated_at: null, _message: 'Exécuter executor-run.js pour mettre à jour le solde.' }));
    return;
  }
  if (pathname === '/api/tibo_report') {
    cors();
    const data = readJsonFile(DATA.dashboard, 'tibo_report.json') || null;
    res.end(JSON.stringify(data || { agent: 'Tibo', updated_at: null, _message: 'Aucun rapport. Exécuter executor-run.js ou executor-tp-scrutator.js pour générer tibo_report.json.' }));
    return;
  }
  if (pathname === '/api/yield_farmer_report') {
    cors();
    const data = readDashboardJson('yield_farmer_report.json') || null;
    res.end(JSON.stringify(data || { source: 'yield_farmer', _message: 'Exécuter yield-report.js pour générer le rapport (data/dashboard/yield_farmer_report.json).' }));
    return;
  }
  if (pathname === '/api/uniswap_v3_arbitrum_pools') {
    cors();
    const data = readDashboardJson('uniswap_v3_arbitrum_pools.json') || null;
    res.end(JSON.stringify(data || { _message: 'Exécuter yield-fetch-pools-arbitrum.js pour générer la liste des pools (data/dashboard/uniswap_v3_arbitrum_pools.json).' }));
    return;
  }
  if (pathname === '/api/hyperliquid_analyst_report') {
    cors();
    const directPath = path.join(ROOT, 'data', 'dashboard', 'hyperliquid_analyst_report.json');
    let data = null;
    if (fs.existsSync(directPath)) {
      try {
        data = JSON.parse(fs.readFileSync(directPath, 'utf8'));
      } catch (_) {}
    }
    if (data == null) data = readDashboardJson('hyperliquid_analyst_report.json') || null;
    res.end(JSON.stringify(data || { _message: 'Exécuter hyperliquid-commodities-scan.js puis hyperliquid-analyst-trend.js (ou cron tradeempire-hyperliquid-analyst).' }));
    return;
  }
  if (pathname === '/api/niches') {
    cors();
    const nichesDir = path.join(DATA.dashboard, 'niches');
    const list = readJsonDir(nichesDir);
    res.end(JSON.stringify(list));
    return;
  }
  if (pathname === '/api/intel') {
    cors();
    const intelDir = path.join(DATA.dashboard, 'intel');
    const feedPath = path.join(intelDir, 'intel_feed.json');
    const trendCardsPath = path.join(intelDir, 'trend_cards.json');
    const scanStatusPath = path.join(intelDir, 'intel_scan_status.json');
    const economicCalendarPath = path.join(intelDir, 'economic_calendar.json');
    const cryptodailyNewsPath = path.join(intelDir, 'cryptodaily_news.json');
    const redditIntelPath = path.join(intelDir, 'reddit_intel.json');
    let feed = [];
    if (fs.existsSync(feedPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
        feed = Array.isArray(raw) ? raw : [];
      } catch (_) { feed = []; }
    }
    let trendCards = { timestamp_utc: null, date: null, cards: [], situation_summary: null, situation_by_source: null };
    if (fs.existsSync(trendCardsPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(trendCardsPath, 'utf8'));
        trendCards = {
          timestamp_utc: raw.timestamp_utc || null,
          date: raw.date || null,
          cards: Array.isArray(raw.cards) ? raw.cards : [],
          situation_summary: raw.situation_summary || null,
          situation_by_source: raw.situation_by_source && typeof raw.situation_by_source === 'object' ? raw.situation_by_source : null,
        };
      } catch (_) {}
    }
    let scan_status = null;
    if (fs.existsSync(scanStatusPath)) {
      try {
        scan_status = JSON.parse(fs.readFileSync(scanStatusPath, 'utf8'));
      } catch (_) {}
    }
    if (!scan_status && (trendCards.timestamp_utc || trendCards.date)) {
      scan_status = {
        last_run_utc: trendCards.timestamp_utc || (trendCards.date ? trendCards.date + 'T12:00:00.000Z' : null),
        x: { status: 'unknown', message: 'Exécuter intel-scan.js pour mettre à jour le statut' },
        youtube: { status: 'unknown', count_ok: 0, count_fail: 0, errors: [] },
      };
    }
    let economic_calendar = { last_updated_utc: null, source: null, events: [] };
    if (fs.existsSync(economicCalendarPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(economicCalendarPath, 'utf8'));
        economic_calendar = { last_updated_utc: raw.last_updated_utc || null, source: raw.source || null, events: Array.isArray(raw.events) ? raw.events : [] };
      } catch (_) {}
    }
    let cryptodaily_news = { last_updated_utc: null, source: null, items: [], error: null };
    if (fs.existsSync(cryptodailyNewsPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(cryptodailyNewsPath, 'utf8'));
        cryptodaily_news = { last_updated_utc: raw.last_updated_utc || null, source: raw.source || null, items: Array.isArray(raw.items) ? raw.items : [], error: raw.error || null, count: raw.count };
      } catch (_) {}
    }
    let reddit_intel = { last_updated_utc: null, source: null, subreddits: [], by_query: {}, count: 0 };
    if (fs.existsSync(redditIntelPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(redditIntelPath, 'utf8'));
        reddit_intel = { last_updated_utc: raw.last_updated_utc || null, source: raw.source || null, subreddits: Array.isArray(raw.subreddits) ? raw.subreddits : [], by_query: raw.by_query || {}, count: raw.count || 0 };
      } catch (_) {}
    }
    const items = [...feed, ...trendCards.cards];
    res.end(JSON.stringify({
      items,
      trend_cards: trendCards,
      trend_cards_date: trendCards.date,
      scan_status: scan_status,
      economic_calendar: economic_calendar,
      cryptodaily_news: cryptodaily_news,
      reddit_intel: reddit_intel,
    }));
    return;
  }
  function readEvolutionsAsProposals(evolutionsPath) {
    if (!fs.existsSync(evolutionsPath)) return null;
    try {
      const md = fs.readFileSync(evolutionsPath, 'utf8');
      const lines = md.split('\n');
      let inSection = false;
      let dateLine = null;
      const proposals = [];
      for (const line of lines) {
        if (line.startsWith('## Dernière mise à jour')) { inSection = false; continue; }
        if (line.startsWith('- **Date** :')) { dateLine = line.replace(/^-\s*\*\*Date\*\*\s*:\s*/i, '').trim(); continue; }
        if (line.startsWith('## Propositions en attente')) { inSection = true; continue; }
        if (line.startsWith('## ')) inSection = false;
        if (inSection && line.startsWith('- **')) {
          const match = line.match(/^-\s*\*\*(.+?)\*\*\s*[:\-]\s*(.*)$/);
          if (match) proposals.push({ title: match[1].trim(), description: match[2].trim(), type: 'spec' });
        }
      }
      return { timestamp_utc: dateLine || null, proposals };
    } catch (_) {
      return null;
    }
  }

  if (pathname === '/api/boss_proposals' || pathname === '/api/evolutions') {
    cors();
    const proposalsPath = path.join(DATA.dashboard, 'boss_proposals.json');
    const fallbackJsonPath = path.join(DATA.dashboard, 'boss_proposals_from_evolutions.json');
    const evolutionsPaths = [
      path.join(__dirname, '..', 'dashboard', 'spec', 'evolutions.md'),
      path.join(DASHBOARD_DIR, 'spec', 'evolutions.md'),
    ];
    let data = { timestamp_utc: null, proposals: [] };
    if (pathname === '/api/boss_proposals' && fs.existsSync(proposalsPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(proposalsPath, 'utf8'));
        data = { timestamp_utc: raw.timestamp_utc || null, proposals: Array.isArray(raw.proposals) ? raw.proposals : [] };
      } catch (_) {}
    }
    if (!data.proposals.length) {
      for (const p of evolutionsPaths) {
        const parsed = readEvolutionsAsProposals(p);
        if (parsed && parsed.proposals.length) {
          data = parsed;
          break;
        }
      }
    }
    if (!data.proposals.length && fs.existsSync(fallbackJsonPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(fallbackJsonPath, 'utf8'));
        if (Array.isArray(raw.proposals) && raw.proposals.length) {
          data = { timestamp_utc: raw.timestamp_utc || null, proposals: raw.proposals };
        }
      } catch (_) {}
    }
    const validatedPath = path.join(DATA.dashboard, 'boss_proposals_validated.json');
    if (fs.existsSync(validatedPath)) {
      try {
        const validated = JSON.parse(fs.readFileSync(validatedPath, 'utf8'));
        const byTitle = (Array.isArray(validated) ? validated : []).reduce((acc, v) => { acc[v.title] = v.validated_at; return acc; }, {});
        data.proposals = data.proposals.map((p) => ({ ...p, validated_at: byTitle[p.title] || null }));
      } catch (_) {}
    }
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/boss_proposals/validate') {
    if (method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }
    if (method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    cors();
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const validatedPath = path.join(DATA.dashboard, 'boss_proposals_validated.json');
      let list = [];
      if (fs.existsSync(validatedPath)) {
        try { list = JSON.parse(fs.readFileSync(validatedPath, 'utf8')); } catch (_) {}
      }
      if (!Array.isArray(list)) list = [];
      try {
        const payload = JSON.parse(body || '{}');
        const title = (payload.title || '').trim();
        if (title) {
          if (!list.some((e) => e.title === title)) {
            list.push({ title, validated_at: new Date().toISOString() });
            fs.writeFileSync(validatedPath, JSON.stringify(list, null, 2), 'utf8');
          }
          const kanban = readJsonFile(DATA.dashboard, 'kanban.json') || { columns: [], tasks: [] };
          if (!kanban.tasks) kanban.tasks = [];
          const id = 'task-' + Date.now();
          kanban.tasks.push({
            id,
            title,
            columnId: 'todo',
            description: payload.description || '',
            source: 'boss_proposal',
            type: payload.type || 'spec',
          });
          fs.writeFileSync(KANBAN_PATH, JSON.stringify(kanban, null, 2), 'utf8');
        }
      } catch (_) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (pathname === '/api/chase_feedback') {
    cors();
    const p = path.join(DATA.dashboard, 'chase_feedback.json');
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { timestamp_utc: null, by_agent: {}, post_mortem_count: 0 };
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/chase_post_mortems') {
    cors();
    const pmDir = path.join(ROOT, 'data', 'tracker', 'post_mortem');
    const all = fs.existsSync(pmDir) ? fs.readdirSync(pmDir).filter((f) => f.endsWith('.md')) : [];
    const dateOnly = all.filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
    const list = (dateOnly.length ? dateOnly : all)
      .map((f) => ({ id: f.replace('.md', ''), file: f, label: /^\d{4}-\d{2}-\d{2}$/.test(f.replace('.md', '')) ? `Compte rendu — ${f.replace('.md', '')}` : f.replace('.md', '') }))
      .sort((a, b) => (a.id > b.id ? -1 : 1));
    res.end(JSON.stringify(list));
    return;
  }
  if (pathname.startsWith('/api/chase_post_mortem/')) {
    const id = pathname.replace(/^\/api\/chase_post_mortem\//, '').replace(/\/$/, '');
    const pmPath = path.join(ROOT, 'data', 'tracker', 'post_mortem', id + '.md');
    if (!fs.existsSync(pmPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(fs.readFileSync(pmPath, 'utf8'));
    return;
  }
  if (pathname === '/api/recovery_report') {
    cors();
    const p = path.join(DATA.dashboard, 'recovery_report.json');
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { timestamp_utc: null, by_outcome: {}, by_symbol: {}, summary: 'Aucun rapport.' };
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/recovery_intraday_report') {
    cors();
    const p = path.join(DATA.dashboard, 'recovery_intraday_report.json');
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { timestamp_utc: null, pending_count: 0, reviews: [], summary: 'Aucune revue intraday.' };
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/scout_proposals') {
    cors();
    const p = path.join(DATA.dashboard, 'scout_proposals.json');
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { timestamp_utc: null, proposals: [], summary: 'Aucune proposition.' };
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/scout_validation_status') {
    cors();
    const p = path.join(DATA.dashboard, 'scout_validation_status.json');
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { timestamp_utc: null, summary: 'Exécuter node scripts/scout-validation-status.js pour générer le statut.', by_symbol: [] };
    res.end(JSON.stringify(data));
    return;
  }
  if (pathname === '/api/agent_profit_suggestions') {
    cors();
    const p = path.join(DATA.dashboard, 'agent_profit_suggestions.json');
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
    res.end(JSON.stringify(Array.isArray(data) ? data : []));
    return;
  }

  const agentPhotoMatch = pathname.match(/^\/api\/agent-photo\/([a-z_]+)$/);
  if (agentPhotoMatch) {
    try {
      const agentId = agentPhotoMatch[1];
      const agentDir = path.join(AGENTS_DIR, agentId);
      if (!fs.existsSync(agentDir) || !fs.statSync(agentDir).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const teamPath = path.join(DASHBOARD_DIR, 'config', 'team.json');
      let photo = agentId + '.png';
      if (fs.existsSync(teamPath)) {
        const team = JSON.parse(fs.readFileSync(teamPath, 'utf8'));
        const agent = team.find((a) => a.id === agentId);
        if (agent && agent.photo) photo = agent.photo;
      }
      const photoPath = path.join(agentDir, photo);
      if (!fs.existsSync(photoPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const buf = fs.readFileSync(photoPath);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': buf.length,
      });
      res.end(buf);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error');
    }
    return;
  }

  const agentFilesMatch = pathname.match(/^\/api\/agent-files\/([a-z_]+)$/);
  if (agentFilesMatch) {
    const agentId = agentFilesMatch[1];
    const agentDir = path.join(AGENTS_DIR, agentId);
    if (!fs.existsSync(agentDir) || !fs.statSync(agentDir).isDirectory()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([]));
      return;
    }
    const allowed = ['agent.md', 'identity.md', 'soul.md', 'memory.md', 'tasks.md', 'tools.md'];
    const files = fs.readdirSync(agentDir).filter((f) => f.endsWith('.md') && allowed.includes(f));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(files.sort()));
    return;
  }

  const agentFileMatch = pathname.match(/^\/api\/agent-file\/([a-z_]+)\/([a-z_.]+\.md)$/);
  if (agentFileMatch) {
    const agentId = agentFileMatch[1];
    const filename = agentFileMatch[2];
    const allowed = ['agent.md', 'identity.md', 'soul.md', 'memory.md', 'tasks.md', 'tools.md'];
    if (!allowed.includes(filename)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    const filePath = path.join(AGENTS_DIR, agentId, filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(fs.readFileSync(filePath, 'utf8'));
    return;
  }

  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(DASHBOARD_DIR, filePath.replace(/^\//, ''));
  if (!path.resolve(filePath).startsWith(path.resolve(DASHBOARD_DIR))) {
    res.statusCode = 403;
    res.end();
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  if (MIME[ext]) res.setHeader('Content-Type', MIME[ext]);
  let body = fs.readFileSync(filePath);
  if (path.basename(filePath) === 'index.html' && body) {
    body = body.toString('utf8');
    const yieldReport = readDashboardJson('yield_farmer_report.json');
    const yieldPools = readDashboardJson('uniswap_v3_arbitrum_pools.json');
    let hyperliquidReport = null;
    const hlPath = path.join(ROOT, 'data', 'dashboard', 'hyperliquid_analyst_report.json');
    if (fs.existsSync(hlPath)) {
      try {
        hyperliquidReport = JSON.parse(fs.readFileSync(hlPath, 'utf8'));
      } catch (_) {}
    }
    if (hyperliquidReport == null) hyperliquidReport = readDashboardJson('hyperliquid_analyst_report.json');
    const boot = JSON.stringify({ report: yieldReport || null, pools: yieldPools || null });
    const hlBoot = JSON.stringify(hyperliquidReport || null).replace(/<\/script>/gi, '<\\/script>');
    const inject = '<script>window.__YIELD_BOOT__=' + boot.replace(/<\/script>/gi, '<\\/script>') + ';</script>\n<script>window.__HYPERLIQUID_BOOT__=' + hlBoot + ';</script>';
    if (body.includes('</head>')) {
      body = body.replace('</head>', inject + '\n</head>');
    } else if (body.includes('<body>')) {
      body = body.replace('<body>', '<body>\n' + inject);
    }
  }
  res.end(Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TradeEmpire dashboard: http://0.0.0.0:${PORT} (localhost, IP, Tailscale)`);
  console.log(`Data dashboard dir: ${RESOLVED_DASHBOARD_DIR}`);
});
