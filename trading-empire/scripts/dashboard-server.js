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
  const pathname = parsed.pathname;
  const method = req.method || 'GET';

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
        kanban.tasks.push({ id, title: body.title || 'Sans titre', columnId: body.columnId || 'todo' });
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
    const data = readJsonFile(DATA.dashboard, 'api_requests.json') || [];
    res.end(JSON.stringify(Array.isArray(data) ? data : []));
    return;
  }
  if (pathname === '/api/costs') {
    cors();
    const data = readJsonFile(DATA.dashboard, 'costs.json') || {};
    res.end(JSON.stringify(data));
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
    let feed = [];
    if (fs.existsSync(feedPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
        feed = Array.isArray(raw) ? raw : [];
      } catch (_) { feed = []; }
    }
    let trendCards = { date: null, cards: [] };
    if (fs.existsSync(trendCardsPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(trendCardsPath, 'utf8'));
        trendCards = { date: raw.date || null, cards: Array.isArray(raw.cards) ? raw.cards : [] };
      } catch (_) {}
    }
    const items = [...feed, ...trendCards.cards];
    res.end(JSON.stringify({ items, trend_cards_date: trendCards.date }));
    return;
  }
  if (pathname === '/api/boss_proposals') {
    cors();
    const proposalsPath = path.join(DATA.dashboard, 'boss_proposals.json');
    const data = fs.existsSync(proposalsPath) ? JSON.parse(fs.readFileSync(proposalsPath, 'utf8')) : { timestamp_utc: null, proposals: [] };
    res.end(JSON.stringify(data));
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
    const list = fs.existsSync(pmDir) ? fs.readdirSync(pmDir).filter((f) => f.endsWith('.md')).map((f) => ({ id: f.replace('.md', ''), file: f })) : [];
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
  res.end(fs.readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`TradeEmpire dashboard: http://127.0.0.1:${PORT}`);
});
