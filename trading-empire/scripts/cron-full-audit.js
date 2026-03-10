#!/usr/bin/env node
/**
 * Audit COMPLET des crons : chaque job activé, chaque script exécuté en conditions réelles.
 * Rapport détaillé par étape, sans omission.
 * Usage: node scripts/cron-full-audit.js [--report-only pour ne pas exécuter]
 * Depuis workspace: node TradeEmpire/trading-empire/scripts/cron-full-audit.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// __dirname = .../workspace/TradeEmpire/trading-empire/scripts → 4x .. = .openclaw
const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT || path.resolve(__dirname, '..', '..', '..', '..');
const WORKSPACE = path.join(OPENCLAW_ROOT, 'workspace');
const WORKSPACE_BOSS = path.join(OPENCLAW_ROOT, 'workspace-boss');
const TE = path.join(WORKSPACE, 'TradeEmpire', 'trading-empire');
const TE_SCRIPTS = path.join(TE, 'scripts');
const CRON_JOBS = path.join(OPENCLAW_ROOT, 'cron', 'jobs.json');
const REPORT_DIR = path.join(TE, 'data', 'reports');

/** Chaque job activé avec ses étapes EXACTES (cmd, cwd, timeout, vérification optionnelle). */
const JOB_STEPS = [
  {
    id: 'tradeempire-cleanup-unexecuted',
    name: 'Nettoyage décisions non exécutées (07:50)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'cleanup-unexecuted-decisions.js')}"`, cwd: WORKSPACE, timeout: 30000, expectStderr: false },
    ],
  },
  {
    id: 'tradeempire-morning',
    name: 'Séquence matin + brief (08:15)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'run-morning.js')}"`, cwd: WORKSPACE, timeout: 120000, expectFile: path.join(TE, 'data', 'ideas'), expectFileKind: 'dir_with_files' },
      { cmd: `node "${path.join(TE_SCRIPTS, 'morning-brief.js')}"`, cwd: WORKSPACE, timeout: 30000, expectStdout: true },
    ],
  },
  {
    id: 'tradeempire-executor',
    name: 'Tibo Executor (08:25)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'build-execution-queue.js')}"`, cwd: WORKSPACE, timeout: 15000, expectFile: path.join(TE, 'data', 'dashboard', 'execution_queue.json') },
      { cmd: `node "${path.join(TE_SCRIPTS, 'executor-run.js')}"`, cwd: WORKSPACE, timeout: 60000, expectStderr: false },
    ],
  },
  {
    id: 'tradeempire-executor-12h',
    name: 'Tibo Executor relance (12:08)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'build-execution-queue.js')}"`, cwd: WORKSPACE, timeout: 15000 },
      { cmd: `node "${path.join(TE_SCRIPTS, 'executor-run.js')}"`, cwd: WORKSPACE, timeout: 60000 },
    ],
  },
  {
    id: 'tradeempire-executor-15h',
    name: 'Tibo Executor relance (15:08)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'build-execution-queue.js')}"`, cwd: WORKSPACE, timeout: 15000 },
      { cmd: `node "${path.join(TE_SCRIPTS, 'executor-run.js')}"`, cwd: WORKSPACE, timeout: 60000 },
    ],
  },
  {
    id: 'tradeempire-tp-scrutator',
    name: 'Tibo Scrutateur TP (toutes les 15 min)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'run-tp-scrutator-if-needed.js')}"`, cwd: WORKSPACE, timeout: 60000 },
    ],
  },
  {
    id: 'tradeempire-evening',
    name: 'Soir (20:30) journal + récap',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'risk-journal-scan.js')}"`, cwd: WORKSPACE, timeout: 45000 },
      { cmd: `node "${path.join(TE_SCRIPTS, 'evening-brief.js')}"`, cwd: WORKSPACE, timeout: 30000, expectStdout: true },
    ],
  },
  {
    id: 'tradeempire-boss-night',
    name: 'BOSS tâche nocturne (01:00)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'boss-night.js')}"`, cwd: WORKSPACE, timeout: 30000, expectFile: path.join(TE, 'data', 'dashboard', 'boss_night_context.json') },
    ],
  },
  {
    id: 'tradeempire-boss-night-whatsapp-fallback',
    name: 'Envoi brief BOSS WhatsApp (01:03)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'boss-night-brief-to-whatsapp-fallback.js')}"`, cwd: WORKSPACE, timeout: 15000 },
    ],
  },
  {
    id: 'tradeempire-intel',
    name: 'Intel / Trend Cards (09:00)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'intel-scan.js')}"`, cwd: WORKSPACE, timeout: 120000, expectFile: path.join(TE, 'data', 'dashboard', 'intel', 'trend_cards.json') },
    ],
  },
  {
    id: 'tradeempire-boss-vision',
    name: 'BOSS vision / expansion (10:00)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'boss-vision.js')}"`, cwd: WORKSPACE, timeout: 60000, expectFile: path.join(TE, 'data', 'dashboard', 'boss_vision_context.json') },
    ],
  },
  {
    id: 'tradeempire-agent-report',
    name: 'Rapport agents (09:40)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'agent-status-report.js')}"`, cwd: WORKSPACE, timeout: 120000, expectFile: path.join(TE, 'data', 'dashboard', 'agent_status_report.json') },
    ],
  },
  {
    id: 'tradeempire-opportunity-scout',
    name: 'Opportunity Scout (09:20)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'opportunity-scout.js')}"`, cwd: WORKSPACE, timeout: 90000, expectFile: path.join(TE, 'data', 'dashboard', 'scout_proposals.json') },
    ],
  },
  {
    id: 'tradeempire-opportunity-scout-1225',
    name: 'Scout (12:25)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'opportunity-scout.js')}" --no-whatsapp`, cwd: WORKSPACE, timeout: 90000 },
    ],
  },
  {
    id: 'tradeempire-opportunity-scout-1525',
    name: 'Scout (15:25)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'opportunity-scout.js')}" --no-whatsapp`, cwd: WORKSPACE, timeout: 90000 },
    ],
  },
  {
    id: 'tradeempire-opportunity-scout-1755',
    name: 'Scout (17:55)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'opportunity-scout.js')}" --no-whatsapp`, cwd: WORKSPACE, timeout: 90000 },
    ],
  },
  {
    id: 'tradeempire-scout-validation-status',
    name: 'Statut validation Scout (09:35)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'scout-validation-status.js')}" --md`, cwd: WORKSPACE, timeout: 30000, expectFile: path.join(TE, 'data', 'dashboard', 'scout_validation_status.json') },
    ],
  },
  {
    id: 'tradeempire-whatsapp-pending',
    name: 'Envoi file WhatsApp (toutes les 15 min)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'send-whatsapp-pending.js')}"`, cwd: WORKSPACE, timeout: 45000 },
    ],
  },
  {
    id: 'tradeempire-recovery-analyst',
    name: 'Recovery Analyst (21:15)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'recovery-analyst-report.js')}" --md`, cwd: WORKSPACE, timeout: 60000, expectFile: path.join(TE, 'data', 'dashboard', 'recovery_report.json') },
    ],
  },
  {
    id: 'tradeempire-chase',
    name: 'Chase / Tracker (21:00)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'chase-tracker.js')}"`, cwd: WORKSPACE, timeout: 60000, expectFile: path.join(TE, 'data', 'dashboard', 'chase_feedback.json') },
    ],
  },
  {
    id: '8e5ac65a-7ff8-47c2-8b00-b378cb5da365',
    name: 'Veille airdrops (09:50)',
    steps: [],
    note: 'Tâche agent uniquement (recherche + write AIRDROPS.md). Aucun script à exécuter.',
  },
  {
    id: 'openclaw-watchguard',
    name: 'Watchguard (toutes les 15 min)',
    steps: [
      { cmd: `node "${path.join(WORKSPACE, 'scripts', 'openclaw-watchguard.js')}"`, cwd: WORKSPACE, timeout: 60000, expectStdoutJson: true },
    ],
  },
  {
    id: 'openclaw-backup-nightly',
    name: 'Backup OpenClaw → Samba (03:00)',
    steps: [
      { cmd: `bash "${path.join(WORKSPACE, 'scripts', 'backup-openclaw-nightly.sh')}"`, cwd: WORKSPACE, timeout: 300000 },
    ],
  },
  {
    id: 'capability-evolver-weekly',
    name: 'Évolution agent (dimanche 04:00)',
    steps: [
      { cmd: `node "${path.join(WORKSPACE, 'skills', 'capability-evolver', 'index.js')}" --review`, cwd: WORKSPACE, timeout: 180000 },
    ],
  },
  {
    id: 'email-todo-6',
    name: 'Consultation mails (06:00)',
    steps: [
      { cmd: `node "${path.join(WORKSPACE, 'scripts', 'imap-todo.js')}" --for-review --since-hours 12`, cwd: WORKSPACE, timeout: 60000 },
    ],
  },
  {
    id: 'email-todo-9',
    name: 'Consultation mails (09:15)',
    steps: [
      { cmd: `node "${path.join(WORKSPACE, 'scripts', 'imap-todo.js')}" --for-review --since-hours 12`, cwd: WORKSPACE, timeout: 60000 },
    ],
  },
  {
    id: 'email-todo-12',
    name: 'Consultation mails (12:00)',
    steps: [
      { cmd: `node "${path.join(WORKSPACE, 'scripts', 'imap-todo.js')}" --for-review --since-hours 12`, cwd: WORKSPACE, timeout: 60000 },
    ],
  },
  {
    id: 'email-todo-15',
    name: 'Consultation mails (15:00)',
    steps: [
      { cmd: `node "${path.join(WORKSPACE, 'scripts', 'imap-todo.js')}" --for-review --since-hours 12`, cwd: WORKSPACE, timeout: 60000 },
    ],
  },
  {
    id: 'email-todo-18',
    name: 'Consultation mails (18:12)',
    steps: [
      { cmd: `node "${path.join(WORKSPACE, 'scripts', 'imap-todo.js')}" --for-review --since-hours 12`, cwd: WORKSPACE, timeout: 60000 },
    ],
  },
  // Recovery intraday (prévu crontab système 12:30, 15:30, 18:00 — jobs OpenClaw désactivés)
  {
    id: 'recovery-intraday-standalone',
    name: 'Recovery intraday (crontab système, 12:30/15:30/18:00)',
    steps: [
      { cmd: `node "${path.join(TE_SCRIPTS, 'technicals-scan.js')}"`, cwd: WORKSPACE, timeout: 60000 },
      { cmd: `node "${path.join(TE_SCRIPTS, 'recovery-intraday-context.js')}"`, cwd: WORKSPACE, timeout: 30000, expectFile: path.join(TE, 'data', 'dashboard', 'recovery_intraday_context.json') },
      { cmd: `node "${path.join(TE_SCRIPTS, 'recovery-intraday-review.js')}" --md`, cwd: WORKSPACE, timeout: 60000 },
    ],
    note: 'Sans --apply-cancel en audit. En prod le standalone exécute aussi l’agent puis --apply-cancel.',
  },
];

function runStep(step, stepIndex) {
  const result = { ok: false, exitCode: null, durationMs: 0, stdout: '', stderr: '', error: null, verification: null };
  const t0 = Date.now();
  try {
    const out = execSync(step.cmd, {
      cwd: step.cwd,
      encoding: 'utf8',
      timeout: step.timeout || 60000,
      maxBuffer: 4 * 1024 * 1024,
    });
    result.stdout = (out || '').slice(0, 2000);
    result.exitCode = 0;
    result.ok = true;
  } catch (e) {
    result.exitCode = e.status ?? (e.signal ? -1 : 1);
    result.stdout = (e.stdout || '').slice(0, 2000);
    result.stderr = (e.stderr || e.message || '').slice(0, 2000);
    result.error = e.message || String(e);
    result.ok = false;
  }
  result.durationMs = Date.now() - t0;

  if (step.expectFile && result.ok) {
    const exists = fs.existsSync(step.expectFile);
    if (step.expectFileKind === 'dir_with_files') {
      const files = exists && fs.statSync(step.expectFile).isDirectory() ? fs.readdirSync(step.expectFile) : [];
      result.verification = exists && files.length > 0 ? `OK (${files.length} fichier(s))` : (exists ? 'KO (dossier vide)' : 'KO (absent)');
    } else {
      result.verification = exists ? 'OK' : 'KO (fichier absent)';
    }
  }
  if (step.expectStdout && result.ok && (!result.stdout || result.stdout.trim().length < 10)) {
    result.verification = (result.verification || '') + (result.verification ? '; ' : '') + 'KO (sortie brief vide ou trop courte)';
  }
  if (step.expectStdoutJson && result.ok) {
    try {
      JSON.parse(result.stdout.trim());
      result.verification = (result.verification || '') + (result.verification ? '; ' : '') + 'OK (JSON valide)';
    } catch (_) {
      result.verification = (result.verification || '') + (result.verification ? '; ' : '') + 'KO (sortie non JSON)';
    }
  }
  return result;
}

function main() {
  const reportOnly = process.argv.includes('--report-only');
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPORT_DIR, `CRON_FULL_AUDIT_${date}.md`);
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  const lines = [];
  lines.push('# Audit COMPLET des crons — ' + date);
  lines.push('');
  lines.push('Chaque job activé, chaque script exécuté en conditions réelles. Rapport par étape.');
  lines.push('');
  lines.push('---');
  lines.push('');

  let totalSteps = 0;
  let totalOk = 0;
  let totalFail = 0;

  for (const job of JOB_STEPS) {
    lines.push('## ' + job.name + ' (`' + job.id + '`)');
    lines.push('');
    if (job.note) {
      lines.push('**Note:** ' + job.note);
      lines.push('');
    }
    if (job.steps.length === 0) {
      lines.push('| Étape | Résultat |');
      lines.push('|-------|----------|');
      lines.push('| (aucun script) | — |');
      lines.push('');
      continue;
    }
    lines.push('| # | Commande | CWD | Exit | Durée | Vérif | Résultat |');
    lines.push('|---|----------|-----|------|-------|-------|----------|');

    for (let i = 0; i < job.steps.length; i++) {
      const step = job.steps[i];
      totalSteps++;
      const cmdShort = step.cmd.length > 80 ? step.cmd.slice(0, 77) + '...' : step.cmd;
      const cwdShort = step.cwd === WORKSPACE ? 'workspace' : step.cwd === WORKSPACE_BOSS ? 'workspace-boss' : step.cwd;

      let result;
      if (reportOnly) {
        result = { ok: null, exitCode: null, durationMs: 0, verification: '(non exécuté)' };
      } else {
        result = runStep(step, i);
        if (result.ok) totalOk++; else totalFail++;
      }

      const exitStr = result.exitCode === null ? '—' : String(result.exitCode);
      const durationStr = result.durationMs ? result.durationMs + ' ms' : '—';
      const verifStr = result.verification || '—';
      const status = result.ok === true ? 'OK' : result.ok === false ? 'FAIL' : '—';
      lines.push('| ' + (i + 1) + ' | `' + cmdShort.replace(/\|/g, ' ') + '` | ' + cwdShort + ' | ' + exitStr + ' | ' + durationStr + ' | ' + verifStr + ' | ' + status + ' |');

      if (!reportOnly && (result.stderr || result.error)) {
        lines.push('');
        lines.push('**stderr/error:**');
        lines.push('```');
        lines.push((result.stderr || result.error || '').slice(0, 500));
        lines.push('```');
        lines.push('');
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Synthèse');
  lines.push('');
  if (!reportOnly) {
    lines.push('- **Étapes exécutées:** ' + totalSteps);
    lines.push('- **OK:** ' + totalOk);
    lines.push('- **FAIL:** ' + totalFail);
  } else {
    lines.push('*(Rapport sans exécution — lancer sans `--report-only` pour exécuter.)*');
  }
  lines.push('');
  lines.push('Généré par `scripts/cron-full-audit.js` à ' + new Date().toISOString() + '.');

  const report = lines.join('\n');
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log('Rapport écrit:', reportPath);
  if (!reportOnly) {
    console.log('Résumé: ' + totalOk + ' OK, ' + totalFail + ' FAIL sur ' + totalSteps + ' étapes.');
  }
}

main();
