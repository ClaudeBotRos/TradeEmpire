#!/usr/bin/env node
/**
 * Audit chaque cron : agent exécutant, dernier run (statut, provider, model, résumé), exécution des scripts.
 * Usage: node scripts/cron-audit-by-agent.js [--no-scripts pour ne pas lancer l'audit scripts]
 * Depuis workspace: node TradeEmpire/trading-empire/scripts/cron-audit-by-agent.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT || path.resolve(__dirname, '..', '..', '..', '..');
const CRON_JOBS = path.join(OPENCLAW_ROOT, 'cron', 'jobs.json');
const CRON_RUNS_DIR = path.join(OPENCLAW_ROOT, 'cron', 'runs');
const TE = path.join(OPENCLAW_ROOT, 'workspace', 'TradeEmpire', 'trading-empire');
const REPORT_DIR = path.join(TE, 'data', 'reports');
const RUN_SCRIPT_AUDIT = !process.argv.includes('--no-scripts');

function getJobs() {
  const raw = fs.readFileSync(CRON_JOBS, 'utf8');
  const data = JSON.parse(raw);
  const jobs = [];
  for (const j of data.jobs || []) {
    const id = j.id;
    const agentId = j.agentId || 'main';
    const name = j.name || id;
    const enabled = j.enabled === true;
    const schedule = j.schedule?.expr || '-';
    const timeout = j.payload?.timeoutSeconds;
    jobs.push({ id, agentId, name, enabled, schedule, timeout });
  }
  return jobs;
}

function getLastRun(jobId) {
  const runFile = path.join(CRON_RUNS_DIR, `${jobId}.jsonl`);
  if (!fs.existsSync(runFile)) return null;
  const content = fs.readFileSync(runFile, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch (_) {
    return null;
  }
}

function runScriptAudit() {
  const auditScript = path.join(TE, 'scripts', 'cron-full-audit.js');
  if (!fs.existsSync(auditScript)) return { ok: false, error: 'cron-full-audit.js introuvable', reportPath: null };
  try {
    execSync(`node "${auditScript}"`, {
      cwd: OPENCLAW_ROOT + '/workspace',
      encoding: 'utf8',
      timeout: 600000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const reports = fs.readdirSync(REPORT_DIR).filter((f) => f.startsWith('CRON_FULL_AUDIT_') && f.endsWith('.md'));
    const latest = reports.sort().pop();
    return { ok: true, reportPath: latest ? path.join(REPORT_DIR, latest) : null };
  } catch (e) {
    return { ok: false, error: e.message || String(e), reportPath: null };
  }
}

function main() {
  const jobs = getJobs();
  const report = [];
  report.push('# Audit crons — agent, exécution, résultats');
  report.push('');
  report.push(`Généré : ${new Date().toISOString()}`);
  report.push('');

  report.push('## 1. Liste des crons (agent exécutant)');
  report.push('');
  report.push('| Job ID | Agent | Nom | Activé | Schedule | Timeout (s) |');
  report.push('|--------|-------|-----|--------|----------|--------------|');

  for (const j of jobs) {
    report.push(`| ${j.id} | **${j.agentId}** | ${(j.name || '').replace(/\|/g, ' ')} | ${j.enabled ? 'Oui' : 'Non'} | ${j.schedule} | ${j.timeout ?? '-'} |`);
  }

  report.push('');
  report.push('## 2. Dernier run par job (statut, provider, modèle, résumé)');
  report.push('');

  for (const j of jobs) {
    const run = getLastRun(j.id);
    if (!run) {
      report.push(`### ${j.id}`);
      report.push('- **Agent attendu :** ' + j.agentId);
      report.push('- **Dernier run :** aucun enregistrement.');
      report.push('');
      continue;
    }
    const status = run.status === 'ok' ? 'ok' : (run.status || '?');
    const provider = run.provider || '-';
    const model = (run.model || '-').replace(/\|/g, ' ');
    const summary = (run.summary || run.error || '-').slice(0, 200).replace(/\n/g, ' ');
    const duration = run.durationMs != null ? `${Math.round(run.durationMs / 1000)}s` : '-';
    const atMs = run.runAtMs || run.ts || run.finishedAt || run.startedAt;
    const at = atMs != null ? new Date(atMs).toISOString() : '-';
    const sessionKey = run.sessionKey || '';
    const agentExecuted = sessionKey.includes('agent:') ? sessionKey.split('agent:')[1].split(':')[0] : '-';

    report.push(`### ${j.id}`);
    report.push('- **Agent config (attendu) :** ' + j.agentId);
    report.push('- **Agent exécutant (dernier run) :** ' + (agentExecuted !== '-' ? agentExecuted : 'non disponible'));
    report.push(`- **Dernier run :** ${at}`);
    report.push(`- **Statut :** ${status} | **Provider :** ${provider} | **Modèle :** ${model} | **Durée :** ${duration}`);
    report.push(`- **Résumé :** ${summary}`);
    report.push('');
  }

  report.push('## Synthèse — statut dernier run (jobs avec enregistrement)');
  report.push('');
  report.push('| Job ID | Agent | Statut | Résumé court |');
  report.push('|--------|-------|--------|--------------|');
  for (const j of jobs) {
    const run = getLastRun(j.id);
    if (!run) continue;
    const st = run.status === 'ok' ? 'ok' : (run.status || '?');
    const sum = (run.summary || run.error || '-').slice(0, 60).replace(/\|/g, ' ');
    report.push(`| ${j.id} | ${j.agentId} | ${st} | ${sum} |`);
  }

  if (RUN_SCRIPT_AUDIT) {
    report.push('## 3. Exécution des scripts (audit technique)');
    report.push('');
    const scriptResult = runScriptAudit();
    if (scriptResult.ok && scriptResult.reportPath) {
      report.push(`Rapport détaillé généré : \`${path.relative(TE, scriptResult.reportPath)}\``);
      report.push('');
      const detail = fs.readFileSync(scriptResult.reportPath, 'utf8');
      report.push(detail.slice(0, 15000));
      if (detail.length > 15000) report.push('\n... (tronqué)');
    } else {
      report.push(scriptResult.error ? `Erreur : ${scriptResult.error}` : 'Aucun rapport généré.');
    }
  } else {
    report.push('## 3. Exécution des scripts');
    report.push('');
    report.push('(Passé avec --no-scripts. Lancer `node TradeEmpire/trading-empire/scripts/cron-full-audit.js` pour l’audit scripts.)');
  }

  const outPath = path.join(REPORT_DIR, `CRON_AUDIT_BY_AGENT_${new Date().toISOString().split('T')[0]}.md`);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(outPath, report.join('\n'), 'utf8');
  console.log('Rapport écrit :', outPath);
  return outPath;
}

main();
