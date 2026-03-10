#!/usr/bin/env node
/**
 * TradeEmpire — Génère le vrai brief BOSS et l'écrit dans last_boss_brief.md.
 * Appelle l'agent BOSS avec une consigne stricte : répondre UNIQUEMENT par le brief (min 400 car).
 * On capture la réponse (JSON) et on l'écrit nous-mêmes dans le fichier — plus de dépendance
 * à l'outil write de l'agent.
 * Usage: node scripts/boss-night-brief-generate.js
 * Prérequis: boss-night.js déjà exécuté (boss_night_context.json à jour).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT || path.join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw');
const CONTEXT_PATH = path.join(ROOT, 'data', 'dashboard', 'boss_night_context.json');
const OUT_PATH = path.join(ROOT, 'data', 'dashboard', 'last_boss_brief.md');
const OUT_PATH_BOSS = path.join(OPENCLAW_ROOT, 'workspace-boss', 'TradeEmpire', 'trading-empire', 'data', 'dashboard', 'last_boss_brief.md');

const MIN_LEN = 400;

const PROMPT = `Lis le fichier data/dashboard/boss_night_context.json (depuis ta racine TradeEmpire/trading-empire). Ta tâche : rédiger ton **brief de nuit complet** pour l'utilisateur (état du système avec wallet_snapshot et data_ages, ce que tu as fait cette nuit, priorités, points d'attention). Respecte notes_contexte (ClawRouter non utilisé, YouTube déjà traité ; si data_ages > 24h, indique que les données Chase/recovery datent du X).
Réponds UNIQUEMENT par le texte du brief. Aucune autre phrase, aucun préfixe. Minimum ${MIN_LEN} caractères.`;

function main() {
  if (!fs.existsSync(CONTEXT_PATH)) {
    console.error('boss_night_context.json absent. Exécute d\'abord : node scripts/boss-night.js');
    process.exit(1);
  }

  const cwd = process.env.OPENCLAW_WORKSPACE || path.join(OPENCLAW_ROOT, 'workspace');
  let raw;
  try {
    raw = execSync(
      'openclaw',
      ['agent', '--agent', 'boss', '-m', PROMPT, '--json', '--timeout', '120'],
      { encoding: 'utf8', cwd, maxBuffer: 2 * 1024 * 1024, timeout: 130000 }
    );
  } catch (e) {
    console.error('openclaw agent a échoué:', e.message || e);
    process.exit(1);
  }

  let brief = '';
  try {
    const out = JSON.parse(raw.trim());
    brief = (out.summary ?? out.reply ?? out.content ?? out.text ?? out.message ?? '').trim();
  } catch (_) {
    const first = raw.trim().slice(0, 200);
    if (first.startsWith('{')) {
      const m = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m) brief = JSON.parse('"' + m[1].replace(/\\/g, '\\\\') + '"');
    }
  }

  if (!brief || brief.length < MIN_LEN) {
    console.error('Réponse agent trop courte ou absente (min ' + MIN_LEN + ' car).');
    process.exit(1);
  }

  const dir = path.dirname(OUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUT_PATH, brief, 'utf8');

  if (path.resolve(OUT_PATH_BOSS) !== path.resolve(OUT_PATH) && fs.existsSync(path.dirname(OUT_PATH_BOSS))) {
    fs.writeFileSync(OUT_PATH_BOSS, brief, 'utf8');
  }

  console.log(JSON.stringify({ ok: true, length: brief.length, file: OUT_PATH }));
}

main();
