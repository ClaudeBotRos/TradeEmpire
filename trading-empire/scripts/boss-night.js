#!/usr/bin/env node
/**
 * TradeEmpire — Contexte BOSS tâche nocturne.
 * Agrège l’état du dashboard (roadmap, api_requests, agent_exchanges, kanban, costs)
 * et écrit data/dashboard/boss_night_context.json pour que le BOSS puisse lire et mettre à jour spec/config.
 * Usage: node scripts/boss-night.js
 * Depuis workspace : node TradeEmpire/trading-empire/scripts/boss-night.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DASH = path.join(ROOT, 'data', 'dashboard');
const SPEC_DIR = path.join(ROOT, 'dashboard', 'spec');
const CONFIG_DIR = path.join(ROOT, 'dashboard', 'config');

function readJson(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function main() {
  const now = new Date();
  const timestampUtc = now.toISOString();

  if (!fs.existsSync(DATA_DASH)) {
    fs.mkdirSync(DATA_DASH, { recursive: true });
  }
  if (!fs.existsSync(SPEC_DIR)) {
    fs.mkdirSync(SPEC_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const roadmap = readJson(path.join(DATA_DASH, 'roadmap.json'));
  const apiRequests = readJson(path.join(DATA_DASH, 'api_requests.json'));
  const agentExchanges = readJson(path.join(DATA_DASH, 'agent_exchanges.json'));
  const kanban = readJson(path.join(DATA_DASH, 'kanban.json'));
  const costs = readJson(path.join(DATA_DASH, 'costs.json'));

  const exchanges = Array.isArray(agentExchanges) ? agentExchanges : [];
  const lastExchanges = exchanges.slice(-50);

  const context = {
    timestamp_utc: timestampUtc,
    summary: {
      roadmap_current: roadmap?.current_step_id || null,
      roadmap_steps_done: (roadmap?.steps || []).filter((s) => s.done).length,
      api_requests_count: Array.isArray(apiRequests) ? apiRequests.length : 0,
      agent_exchanges_count: exchanges.length,
      has_kanban: !!kanban,
      has_costs: !!costs,
    },
    roadmap,
    api_requests: apiRequests,
    agent_exchanges: lastExchanges,
    kanban,
    costs,
    instructions: [
      'Lire ce contexte et les fichiers dans data/dashboard/ si besoin.',
      'Mettre à jour dashboard/spec/ (ex. spec/evolutions.md) avec des propositions d’amélioration dashboard.',
      'Prioriser les Besoins API et écrire le résultat dans dashboard/config/api_needs_priority.md.',
      'Si tu proposes de nouvelles règles, tâches ou specs (créations nocturnes), écris-les dans data/dashboard/boss_proposals.json : { "timestamp_utc": "<ISO>", "proposals": [ { "title": "...", "description": "...", "type": "rule"|"task"|"spec" } ] }. Validation humaine requise avant application.',
      'Répondre par une ligne de synthèse (ex. « BOSS nuit OK — 3 besoins API priorisés, 2 idées spec »).',
    ],
  };

  const outPath = path.join(DATA_DASH, 'boss_night_context.json');
  fs.writeFileSync(outPath, JSON.stringify(context, null, 2), 'utf8');
  console.log('BOSS night context written to', outPath);
  console.log(JSON.stringify({ ok: true, file: outPath, summary: context.summary }));
}

main();
