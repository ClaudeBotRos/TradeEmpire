#!/usr/bin/env node
/**
 * TradeEmpire — Applique les tâches Kanban marquées comme complétées par le BOSS.
 * Lit data/dashboard/kanban_completed.json (completed_ids) et met à jour
 * data/dashboard/kanban.json : les tâches listées passent en colonne "Fait" (done).
 * À lancer après la tâche nocturne BOSS (cron 01:00).
 * Usage: node scripts/apply-kanban-completed.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DASH = path.join(ROOT, 'data', 'dashboard');
const KANBAN_PATH = path.join(DATA_DASH, 'kanban.json');
const COMPLETED_PATH = path.join(DATA_DASH, 'kanban_completed.json');

function main() {
  if (!fs.existsSync(COMPLETED_PATH)) {
    console.log('Aucun fichier kanban_completed.json — rien à appliquer.');
    return;
  }
  let completed;
  try {
    completed = JSON.parse(fs.readFileSync(COMPLETED_PATH, 'utf8'));
  } catch (e) {
    console.error('Erreur lecture kanban_completed.json:', e.message);
    process.exit(1);
  }
  const ids = Array.isArray(completed.completed_ids) ? completed.completed_ids : [];
  if (ids.length === 0) {
    console.log('Aucune tâche complétée à appliquer.');
    return;
  }
  let kanban;
  try {
    kanban = JSON.parse(fs.readFileSync(KANBAN_PATH, 'utf8'));
  } catch (e) {
    console.error('Erreur lecture kanban.json:', e.message);
    process.exit(1);
  }
  if (!kanban.tasks) kanban.tasks = [];
  let moved = 0;
  for (const id of ids) {
    const task = kanban.tasks.find((t) => t.id === id);
    if (task && task.columnId !== 'done') {
      task.columnId = 'done';
      moved++;
    }
  }
  fs.writeFileSync(KANBAN_PATH, JSON.stringify(kanban, null, 2), 'utf8');
  fs.writeFileSync(COMPLETED_PATH, JSON.stringify({ completed_ids: [], timestamp_utc: new Date().toISOString(), _applied: moved }, null, 2), 'utf8');
  console.log('Kanban mis à jour :', moved, 'tâche(s) déplacée(s) en "Fait".');
}

main();
