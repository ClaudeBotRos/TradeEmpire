#!/usr/bin/env node
/**
 * TradeEmpire — Déplace les décisions APPROVED jamais exécutées (au-delà d’un certain âge) vers expired/.
 * Évite de laisser des traces et des erreurs (executor, recovery). Ne lit que data/decisions/ et executed_orders.
 * Usage: node scripts/cleanup-unexecuted-decisions.js
 * Env: CLEANUP_UNEXECUTED_HOURS (défaut 48) = déplacer les APPROVED non exécutées plus vieilles que N heures.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DECISIONS_DIR = path.join(ROOT, 'data', 'decisions');
const EXPIRED_DIR = path.join(DECISIONS_DIR, 'expired');
const EXECUTED_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');

const HOURS = parseInt(process.env.CLEANUP_UNEXECUTED_HOURS || '48', 10);
const CUTOFF_MS = Date.now() - HOURS * 60 * 60 * 1000;

function loadExecutedIds() {
  if (!fs.existsSync(EXECUTED_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(EXECUTED_PATH, 'utf8'));
    return new Set((Array.isArray(data) ? data : []).map((e) => e.trade_id));
  } catch (_) {
    return new Set();
  }
}

function main() {
  if (!fs.existsSync(DECISIONS_DIR)) {
    console.log(JSON.stringify({ ok: true, moved: 0 }));
    return;
  }

  if (!fs.existsSync(EXPIRED_DIR)) {
    fs.mkdirSync(EXPIRED_DIR, { recursive: true });
  }

  const executedIds = loadExecutedIds();
  const files = fs.readdirSync(DECISIONS_DIR).filter((f) => f.endsWith('_APPROVED.json'));
  let moved = 0;

  for (const f of files) {
    const filePath = path.join(DECISIONS_DIR, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
      continue;
    }
    if (data.status !== 'APPROVED' || !data.trade_id) continue;
    if (executedIds.has(data.trade_id)) continue;

    const ts = data.timestamp_utc ? new Date(data.timestamp_utc).getTime() : 0;
    if (ts >= CUTOFF_MS) continue;

    const destPath = path.join(EXPIRED_DIR, f);
    try {
      fs.renameSync(filePath, destPath);
      moved++;
    } catch (e) {
      console.warn('cleanup: impossible de déplacer', f, e.message);
    }
  }

  console.log(JSON.stringify({ ok: true, moved, hours: HOURS }));
}

main();
