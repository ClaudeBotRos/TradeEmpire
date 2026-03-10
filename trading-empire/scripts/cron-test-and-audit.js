#!/usr/bin/env node
/**
 * Test + audit : exécute les scripts critiques (sans LLM), puis lance N crons réels et enregistre les résultats.
 * Usage: node scripts/cron-test-and-audit.js [--scripts-only] [--crons-only] [--crons "id1,id2"]
 * Sans option : scripts puis crons (cleanup, intel, tp-scrutator).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT || path.resolve(__dirname, '..', '..', '..', '..');
const WORKSPACE = path.join(OPENCLAW_ROOT, 'workspace');
const TE = path.join(WORKSPACE, 'TradeEmpire', 'trading-empire');
const TE_SCRIPTS = path.join(TE, 'scripts');
const REPORT_DIR = path.join(TE, 'data', 'reports');
const CRON_RUNS = path.join(OPENCLAW_ROOT, 'cron', 'runs');

// Scripts rapides à tester (sans APIs lourdes / 429)
const SCRIPT_TESTS = [
  { name: 'cleanup-unexecuted-decisions', cmd: `node "${path.join(TE_SCRIPTS, 'cleanup-unexecuted-decisions.js')}"`, cwd: WORKSPACE, timeout: 15000 },
  { name: 'build-execution-queue', cmd: `node "${path.join(TE_SCRIPTS, 'build-execution-queue.js')}"`, cwd: WORKSPACE, timeout: 20000 },
  { name: 'executor-run', cmd: `node "${path.join(TE_SCRIPTS, 'executor-run.js')}"`, cwd: WORKSPACE, timeout: 30000 },
  { name: 'morning-brief', cmd: `node "${path.join(TE_SCRIPTS, 'morning-brief.js')}"`, cwd: WORKSPACE, timeout: 15000 },
  { name: 'evening-brief', cmd: `node "${path.join(TE_SCRIPTS, 'evening-brief.js')}"`, cwd: WORKSPACE, timeout: 15000 },
  { name: 'boss-vision', cmd: `node "${path.join(TE_SCRIPTS, 'boss-vision.js')}"`, cwd: WORKSPACE, timeout: 25000 },
  { name: 'agent-status-report', cmd: `node "${path.join(TE_SCRIPTS, 'agent-status-report.js')}"`, cwd: WORKSPACE, timeout: 30000 },
  { name: 'scout-validation-status', cmd: `node "${path.join(TE_SCRIPTS, 'scout-validation-status.js')}" --md`, cwd: WORKSPACE, timeout: 15000 },
  { name: 'send-whatsapp-pending', cmd: `node "${path.join(TE_SCRIPTS, 'send-whatsapp-pending.js')}"`, cwd: WORKSPACE, timeout: 15000 },
  { name: 'technicals-scan', cmd: `node "${path.join(TE_SCRIPTS, 'technicals-scan.js')}"`, cwd: WORKSPACE, timeout: 45000 },
  { name: 'recovery-intraday-review (dry)', cmd: `node "${path.join(TE_SCRIPTS, 'recovery-intraday-review.js')}" --md`, cwd: WORKSPACE, timeout: 20000 },
];

const CRON_IDS_TO_RUN = process.argv.includes('--crons') 
  ? process.argv[process.argv.indexOf('--crons') + 1].split(',').map(s => s.trim())
  : ['tradeempire-cleanup-unexecuted', 'tradeempire-intel', 'tradeempire-tp-scrutator'];

function runScriptTest(t) {
  const result = { name: t.name, ok: false, exitCode: null, durationMs: 0, error: null };
  const t0 = Date.now();
  try {
    execSync(t.cmd, { cwd: t.cwd, encoding: 'utf8', timeout: t.timeout || 30000, maxBuffer: 2 * 1024 * 1024 });
    result.ok = true;
    result.exitCode = 0;
  } catch (e) {
    result.exitCode = e.status ?? (e.signal ? -1 : 1);
    result.error = (e.stderr || e.message || '').slice(0, 300);
  }
  result.durationMs = Date.now() - t0;
  return result;
}

function getLastRun(jobId) {
  const p = path.join(CRON_RUNS, `${jobId}.jsonl`);
  if (!fs.existsSync(p)) return null;
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch (_) {
    return null;
  }
}

function runCronAndCapture(jobId) {
  const t0 = Date.now();
  let exitCode = -1;
  let stderr = '';
  try {
    execSync(`openclaw cron run ${jobId}`, {
      cwd: OPENCLAW_ROOT,
      encoding: 'utf8',
      timeout: 200000,
      maxBuffer: 4 * 1024 * 1024,
    });
    exitCode = 0;
  } catch (e) {
    exitCode = e.status ?? (e.signal ? -1 : 1);
    stderr = (e.stderr || e.message || '').slice(0, 500);
  }
  const durationMs = Date.now() - t0;
  const run = getLastRun(jobId);
  return {
    jobId,
    exitCode,
    durationMs,
    stderr: stderr || null,
    lastRun: run ? { status: run.status, provider: run.provider, model: run.model, summary: (run.summary || run.error || '').slice(0, 150) } : null,
  };
}

function main() {
  const scriptsOnly = process.argv.includes('--scripts-only');
  const cronsOnly = process.argv.includes('--crons-only');
  const date = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 12);
  const reportPath = path.join(REPORT_DIR, `CRON_TEST_AUDIT_${date}.md`);
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const lines = [];
  lines.push('# Test et audit crons — ' + new Date().toISOString());
  lines.push('');

  if (!cronsOnly) {
    lines.push('## 1. Exécution des scripts (sans LLM)');
    lines.push('');
    lines.push('| Script | Exit | Durée (ms) | Résultat |');
    lines.push('|--------|------|------------|----------|');
    let okCount = 0;
    for (const t of SCRIPT_TESTS) {
      const r = runScriptTest(t);
      if (r.ok) okCount++;
      lines.push('| ' + t.name + ' | ' + (r.exitCode ?? '—') + ' | ' + r.durationMs + ' | ' + (r.ok ? 'OK' : 'FAIL') + ' |');
      if (r.error) lines.push('| | **error** | ' + r.error.replace(/\n/g, ' ') + ' |');
    }
    lines.push('');
    lines.push('**Résumé scripts :** ' + okCount + '/' + SCRIPT_TESTS.length + ' OK.');
    lines.push('');
  }

  if (!scriptsOnly) {
    lines.push('## 2. Exécution crons réels (openclaw cron run)');
    lines.push('');
    for (const id of CRON_IDS_TO_RUN) {
      lines.push('### ' + id);
      const r = runCronAndCapture(id);
      lines.push('- **Exit code openclaw :** ' + r.exitCode);
      lines.push('- **Durée :** ' + Math.round(r.durationMs / 1000) + ' s');
      if (r.lastRun) {
        lines.push('- **Dernier run enregistré — status :** ' + r.lastRun.status + ' | **provider :** ' + (r.lastRun.provider || '-') + ' | **model :** ' + (r.lastRun.model || '-') + '');
        lines.push('- **Résumé :** ' + (r.lastRun.summary || '-'));
      } else {
        lines.push('- **Dernier run :** non disponible');
      }
      if (r.stderr) lines.push('- **stderr :** ' + r.stderr);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('Rapport généré par `cron-test-and-audit.js`.');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log('Rapport écrit :', reportPath);
}

main();
