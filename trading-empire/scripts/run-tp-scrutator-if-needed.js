#!/usr/bin/env node
/**
 * Lance le scrutateur TP uniquement s'il y a des TP en attente (executor_pending_tp.json non vide).
 * Appelé par le cron pour éviter appels ASTER inutiles quand tous les ordres ont déjà un TP.
 * Usage: node scripts/run-tp-scrutator-if-needed.js
 * (Depuis workspace root: node TradeEmpire/trading-empire/scripts/run-tp-scrutator-if-needed.js)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PENDING_TP_PATH = path.join(ROOT, 'data', 'dashboard', 'executor_pending_tp.json');

function loadPendingTp() {
  if (!fs.existsSync(PENDING_TP_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(PENDING_TP_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

const pending = loadPendingTp();
if (pending.length === 0) {
  console.log('Tibo Scrutator : aucun TP en attente, exécution ignorée.');
  process.exit(0);
}

console.log('Tibo Scrutator :', pending.length, 'TP en attente → lancement du scrutateur.');
const scrutatorPath = path.join(__dirname, 'executor-tp-scrutator.js');
const result = spawnSync(process.execPath, [scrutatorPath], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status !== null ? result.status : 0);
