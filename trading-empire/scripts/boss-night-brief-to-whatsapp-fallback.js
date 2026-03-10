#!/usr/bin/env node
/**
 * TradeEmpire — Envoi du brief nocturne BOSS vers WhatsApp.
 * 1) Si le dernier run BOSS a réussi (status ok, summary longue), on écrit ce summary
 *    dans last_boss_brief.md nous-mêmes (c'est le VRAI brief).
 * 2) On n'envoie que si on a un brief récent (fichier < 2 h) ET que le dernier run
 *    a réussi — ainsi on n'envoie jamais un vieux message.
 * À lancer après le run BOSS (ex. cron 01:03).
 * Usage: node scripts/boss-night-brief-to-whatsapp-fallback.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT || path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw');
const RUNS_FILE = path.join(OPENCLAW_ROOT, 'cron', 'runs', 'tradeempire-boss-night.jsonl');
const BRIEF_PATHS = [
  path.join(ROOT, 'data', 'dashboard', 'last_boss_brief.md'),
  path.join(OPENCLAW_ROOT, 'workspace-boss', 'TradeEmpire', 'trading-empire', 'data', 'dashboard', 'last_boss_brief.md'),
  path.join(OPENCLAW_ROOT, 'workspace', 'TradeEmpire', 'trading-empire', 'data', 'dashboard', 'last_boss_brief.md'),
];
const NOTIF_DIR = path.join(ROOT, 'data', 'notifications');
const QUEUE_FILE = path.join(NOTIF_DIR, 'whatsapp_pending.json');

const MAX_AGE_BRIEF_MS = 2 * 60 * 60 * 1000; // 2 h
const MIN_BRIEF_LENGTH = 400;
const MAX_AGE_RUN_MS = 30 * 60 * 1000; // run considéré "ce soir" si < 30 min

function getLastRun() {
  if (!fs.existsSync(RUNS_FILE)) return null;
  const lines = fs.readFileSync(RUNS_FILE, 'utf8').trim().split('\n').filter((l) => l.trim());
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch (_) {
    return null;
  }
}

function writeBriefToFiles(text) {
  for (const p of BRIEF_PATHS) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, text, 'utf8');
  }
}

function main() {
  const lastRun = getLastRun();
  const runOk = lastRun && lastRun.status === 'ok';
  const runAge = lastRun && lastRun.runAtMs ? Date.now() - lastRun.runAtMs : Infinity;
  const runRecent = runAge <= MAX_AGE_RUN_MS;

  let summary = (lastRun && lastRun.summary) || '';
  if (typeof summary !== 'string') summary = '';
  const summaryValid = summary.length >= MIN_BRIEF_LENGTH && !/^(⚠️|Message failed|Error|error:|Connection error)/i.test(summary.trim());

  if (runOk && summaryValid) {
    writeBriefToFiles(summary.trim());
  }

  let brief = null;
  for (const p of BRIEF_PATHS) {
    if (!fs.existsSync(p)) continue;
    const stat = fs.statSync(p);
    if (Date.now() - stat.mtimeMs > MAX_AGE_BRIEF_MS) continue;
    const raw = fs.readFileSync(p, 'utf8').trim();
    if (raw.length >= MIN_BRIEF_LENGTH) {
      brief = raw;
      break;
    }
  }

  if (!brief || !runOk || !runRecent) {
    console.log(JSON.stringify({
      ok: true,
      pushed: false,
      reason: brief ? 'last_run_failed_or_old' : 'no_recent_brief_file',
      lastRunStatus: lastRun ? lastRun.status : null,
      runAgeMin: runAge !== Infinity ? Math.round(runAge / 60000) : null,
    }));
    return;
  }

  if (!fs.existsSync(NOTIF_DIR)) fs.mkdirSync(NOTIF_DIR, { recursive: true });
  let queue = [];
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      if (!Array.isArray(queue)) queue = [];
    } catch (_) {
      queue = [];
    }
  }

  const msg = `[BOSS] Brief de nuit:\n\n${brief}`;
  queue.push({
    agentId: 'boss',
    message: msg,
    createdAt: new Date().toISOString(),
  });
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
  console.log(JSON.stringify({ ok: true, pushed: true, summaryLength: brief.length }));
}

main();
