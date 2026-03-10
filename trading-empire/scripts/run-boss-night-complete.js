#!/usr/bin/env node
/**
 * EXÉCUTION COMPLÈTE : Contexte → BOSS (agent) → récupération du brief → envoi WhatsApp.
 * Utilise openclaw agent --json pour récupérer le vrai texte de la réponse (result.payloads[0].text).
 * Usage: node scripts/run-boss-night-complete.js
 * Depuis ~/.openclaw : node workspace/TradeEmpire/trading-empire/scripts/run-boss-night-complete.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT || path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw');
const WORKSPACE = path.join(OPENCLAW_ROOT, 'workspace');
const NOTIF_DIR = path.join(ROOT, 'data', 'notifications');
const QUEUE_FILE = path.join(NOTIF_DIR, 'whatsapp_pending.json');
const BRIEF_PATHS = [
  path.join(ROOT, 'data', 'dashboard', 'last_boss_brief.md'),
  path.join(OPENCLAW_ROOT, 'workspace-boss', 'TradeEmpire', 'trading-empire', 'data', 'dashboard', 'last_boss_brief.md'),
];

const BOSS_MESSAGE = `TradeEmpire BOSS tâche nocturne. Contexte obligatoire : roadmap 8/8 (trading RÉEL) ; on utilise UNIQUEMENT OpenRouter (jamais mentionner ClawRouter) ; pas de radotage YouTube/borderline ; si Chase/recovery sont anciens, ne pas citer des pertes comme récentes. (1) Exécute : node TradeEmpire/trading-empire/scripts/boss-night.js. (2) Lis data/dashboard/boss_night_context.json et respecte notes_contexte. (3) Rédige ton **brief de nuit complet** (état du système, solde wallet_snapshot, roadmap 8/8, ce que tu as fait, priorités ; min. 400 car). (4) Mets à jour evolutions.md et api_needs_priority.md si besoin (OpenRouter + X uniquement). Kanban : kanban_completed.json puis apply-kanban-completed.js. (5) Ta **réponse** = UNIQUEMENT le texte du brief. Rien d'autre.`;

const MIN_BRIEF_LEN = 400;

function main() {
  console.log('[1/4] Contexte BOSS…');
  execSync('node TradeEmpire/trading-empire/scripts/boss-night.js', {
    cwd: WORKSPACE,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  console.log('[2/4] Run BOSS (agent, timeout 300s)…');
  const msgFile = path.join(ROOT, 'data', 'dashboard', '.boss_run_message.txt');
  fs.writeFileSync(msgFile, BOSS_MESSAGE, 'utf8');
  let raw;
  try {
    raw = execSync(
      'openclaw agent --agent boss --json --timeout 300 -m "$(cat ' + msgFile.replace(/'/g, "'\\''") + ')"',
      { encoding: 'utf8', cwd: OPENCLAW_ROOT, maxBuffer: 4 * 1024 * 1024, timeout: 320000, shell: '/bin/bash' }
    );
  } catch (e) {
    console.error('Erreur agent:', e.message || e);
    process.exit(1);
  } finally {
    try { fs.unlinkSync(msgFile); } catch (_) {}
  }

  let brief = '';
  try {
    const out = JSON.parse(raw.trim());
    const payloads = out?.result?.payloads || [];
    const text = payloads[0]?.text || out?.summary || '';
    brief = (typeof text === 'string' ? text : '').trim();
  } catch (_) {
    console.error('Parse JSON échoué');
    process.exit(1);
  }

  if (brief.length < MIN_BRIEF_LEN) {
    console.error('Brief trop court (' + brief.length + ' car, min ' + MIN_BRIEF_LEN + ')');
    process.exit(1);
  }

  console.log('[3/4] Écriture last_boss_brief.md + file WhatsApp…');
  for (const p of BRIEF_PATHS) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, brief, 'utf8');
  }

  if (!fs.existsSync(NOTIF_DIR)) fs.mkdirSync(NOTIF_DIR, { recursive: true });
  let queue = [];
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      if (!Array.isArray(queue)) queue = [];
    } catch (_) {}
  }
  queue.push({
    agentId: 'boss',
    message: '[BOSS] Brief de nuit:\n\n' + brief,
    createdAt: new Date().toISOString(),
  });
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');

  console.log('[4/4] Envoi WhatsApp…');
  execSync('node scripts/send-whatsapp-pending.js', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  console.log('EXÉCUTION COMPLÈTE. Brief envoyé (' + brief.length + ' car).');
}

main();
