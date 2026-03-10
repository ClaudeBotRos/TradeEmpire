#!/usr/bin/env node
/**
 * TradeEmpire — Création d'un agent à partir d'une spec rédigée par le BOSS.
 * Lit data/dashboard/boss_create_agent_spec.json et crée agents/<agent_id>/ avec soul.md, tasks.md, tools.md,
 * ajoute l'entrée au dashboard team.json, et écrit un snippet cron suggéré.
 *
 * Usage: node scripts/create-agent-from-spec.js [--dry-run]
 * Spec attendue (boss_create_agent_spec.json):
 * {
 *   "agent_id": "mon_agent",        // snake_case, pas de ../
 *   "display_name": "Mon Agent",
 *   "skills_short": "Une phrase.",
 *   "soul_md": "# Soul\n\n...",
 *   "tasks_md": "# Tâches\n\n...",
 *   "tools_md": "# Outils\n\n...",
 *   "cron_schedule": "30 10 * * *", // optionnel, ex. 10h30 chaque jour
 *   "cron_message": "..."           // optionnel, message pour le payload agentTurn
 * }
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPEC_PATH = path.join(ROOT, 'data', 'dashboard', 'boss_create_agent_spec.json');
const AGENTS_DIR = path.join(ROOT, 'agents');
const TEAM_PATH = path.join(ROOT, 'dashboard', 'config', 'team.json');
const DASHBOARD_DATA = path.join(ROOT, 'data', 'dashboard');

function safeId(id) {
  if (!id || typeof id !== 'string') return null;
  const cleaned = id.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!fs.existsSync(SPEC_PATH)) {
    console.error('create-agent-from-spec: fichier spec introuvable:', SPEC_PATH);
    process.exit(1);
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  } catch (e) {
    console.error('create-agent-from-spec: spec JSON invalide:', e.message);
    process.exit(1);
  }

  const agentId = safeId(spec.agent_id);
  if (!agentId) {
    console.error('create-agent-from-spec: agent_id manquant ou invalide (attendu: snake_case)');
    process.exit(1);
  }

  const displayName = (spec.display_name || agentId).trim();
  const skillsShort = (spec.skills_short || '').trim();
  const soulMd = (spec.soul_md || `# ${displayName} — Soul\n\n*À compléter.*\n`).trim();
  const tasksMd = (spec.tasks_md || `# Tâches ${displayName}\n\n*À compléter.*\n`).trim();
  const toolsMd = (spec.tools_md || `# Outils ${displayName}\n\n*À compléter.*\n`).trim();

  const agentDir = path.join(AGENTS_DIR, agentId);
  if (fs.existsSync(agentDir)) {
    console.error('create-agent-from-spec: le dossier agent existe déjà:', agentDir);
    process.exit(1);
  }

  if (dryRun) {
    console.log('[dry-run] Créerait', agentDir, 'avec soul.md, tasks.md, tools.md');
    console.log('[dry-run] Mise à jour team.json avec id:', agentId, 'name:', displayName);
    process.exit(0);
  }

  fs.mkdirSync(agentDir, { recursive: true });
  fs.writeFileSync(path.join(agentDir, 'soul.md'), soulMd + '\n', 'utf8');
  fs.writeFileSync(path.join(agentDir, 'tasks.md'), tasksMd + '\n', 'utf8');
  fs.writeFileSync(path.join(agentDir, 'tools.md'), toolsMd + '\n', 'utf8');
  console.log('Agent créé:', agentDir);

  let team = [];
  try {
    const raw = fs.readFileSync(TEAM_PATH, 'utf8');
    team = JSON.parse(raw);
    if (!Array.isArray(team)) team = [];
  } catch (_) {}

  if (team.some((e) => (e.id || '').toLowerCase() === agentId)) {
    console.log('Agent déjà présent dans team.json, skip.');
  } else {
    team.push({
      id: agentId,
      name: displayName,
      skills: skillsShort || 'À définir.',
      photo: 'agent.png',
      apis_used: [],
    });
    fs.writeFileSync(TEAM_PATH, JSON.stringify(team, null, 2), 'utf8');
    console.log('team.json mis à jour.');
  }

  const cronExpr = (spec.cron_schedule || '').trim();
  const cronMessage = (spec.cron_message || '').trim();
  if (cronExpr || cronMessage) {
    const snippet = {
      id: `tradeempire-${agentId.replace(/_/g, '-')}`,
      agentId: 'main',
      name: `TradeEmpire — ${displayName}`,
      enabled: false,
      schedule: { kind: 'cron', expr: cronExpr || '0 10 * * *', tz: 'Europe/Paris' },
      sessionTarget: 'isolated',
      wakeMode: 'now',
      payload: {
        kind: 'agentTurn',
        message: cronMessage || `Exécuter la tâche de l'agent ${displayName}. Depuis ~/.openclaw/workspace : voir TradeEmpire/trading-empire/agents/${agentId}/tasks.md et tools.md.`,
        timeoutSeconds: 90,
      },
      delivery: { mode: 'none' },
    };
    const snippetPath = path.join(DASHBOARD_DATA, `suggested_cron_agent_${agentId}.json`);
    fs.mkdirSync(DASHBOARD_DATA, { recursive: true });
    fs.writeFileSync(snippetPath, JSON.stringify(snippet, null, 2), 'utf8');
    console.log('Snippet cron suggéré:', snippetPath);
  }

  try {
    fs.unlinkSync(SPEC_PATH);
  } catch (_) {}
  console.log(JSON.stringify({ ok: true, agent_id: agentId, path: agentDir }));
}

main();
