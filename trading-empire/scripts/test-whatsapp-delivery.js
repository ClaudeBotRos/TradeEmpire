#!/usr/bin/env node
/**
 * Test réel : file WhatsApp → send-whatsapp-pending → openclaw message send.
 * Enregistre une preuve (rapport JSON + optionnellement envoi d’un message TEST).
 * Usage:
 *   node scripts/test-whatsapp-delivery.js              # envoie 1 message TEST, puis flush, rapport dans data/reports/
 *   node scripts/test-whatsapp-delivery.js --dry-run     # ne pas envoyer, seulement lire la file et simuler
 * Depuis workspace : node TradeEmpire/trading-empire/scripts/test-whatsapp-delivery.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'data', 'notifications', 'whatsapp_pending.json');
const REPORT_DIR = path.join(ROOT, 'data', 'reports');
const SEND_SCRIPT = path.join(__dirname, 'send-whatsapp-pending.js');
const { pushToQueue } = require('./whatsapp-queue-push.js');

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = path.join(REPORT_DIR, `whatsapp_delivery_test_${ts}.json`);

  const report = {
    timestamp_utc: new Date().toISOString(),
    dryRun,
    steps: [],
    queueBefore: null,
    queueAfter: null,
    sendStdout: null,
    sendStderr: null,
    sendExitCode: null,
    conclusion: null,
  };

  // 1) État initial de la file
  let queueBefore = [];
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      queueBefore = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      if (!Array.isArray(queueBefore)) queueBefore = [];
    } catch (_) {}
  }
  report.queueBefore = queueBefore.length;
  report.steps.push({ step: 'read_queue_before', count: queueBefore.length });

  // 2) Ajouter un message TEST unique (pour vérifier réception sur le téléphone)
  if (!dryRun) {
    const testMsg = `[TEST TradeEmpire] Si tu reçois ceci, le flux file → WhatsApp fonctionne. ${new Date().toISOString()}`;
    pushToQueue('orchestrator', testMsg);
    report.steps.push({ step: 'push_test_message', message_preview: testMsg.slice(0, 60) + '…' });
  }

  // 3) Exécuter send-whatsapp-pending
  try {
    const result = execSync(`node "${SEND_SCRIPT}"`, {
      cwd: path.join(ROOT, '..', '..'), // workspace
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    report.sendStdout = (result || '').trim();
    report.sendExitCode = 0;
    report.steps.push({ step: 'send_whatsapp_pending', exitCode: 0, stdout: report.sendStdout });
  } catch (e) {
    report.sendStdout = (e.stdout || '').trim();
    report.sendStderr = (e.stderr || e.message || '').trim();
    report.sendExitCode = e.status ?? (e.signal ? -1 : 1);
    report.steps.push({ step: 'send_whatsapp_pending', exitCode: report.sendExitCode, stderr: report.sendStderr });
  }

  // 4) État final de la file
  let queueAfter = [];
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      queueAfter = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      if (!Array.isArray(queueAfter)) queueAfter = [];
    } catch (_) {}
  }
  report.queueAfter = queueAfter.length;
  report.steps.push({ step: 'read_queue_after', count: queueAfter.length });

  // 5) Conclusion
  let parsed = { sent: 0 };
  try {
    parsed = JSON.parse(report.sendStdout || '{}');
  } catch (_) {}
  const sent = parsed.sent ?? 0;
  if (report.sendExitCode !== 0) {
    report.conclusion = 'FAIL: send-whatsapp-pending a échoué (exit ' + report.sendExitCode + ').';
  } else if (dryRun) {
    report.conclusion = 'DRY_RUN: aucun envoi (--dry-run).';
  } else if (sent >= 1 && report.queueAfter < (report.queueBefore + 1)) {
    report.conclusion = 'OK: ' + sent + ' message(s) envoyé(s) (openclaw message send a réussi). Vérifie ton WhatsApp pour le message [TEST TradeEmpire].';
  } else {
    report.conclusion = 'PARTIAL: sent=' + sent + ', queue_after=' + report.queueAfter + '. Vérifier gateway / openclaw message send.';
  }

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Rapport:', reportPath);
  console.log(report.conclusion);
  if (report.sendStdout) console.log('Stdout:', report.sendStdout);
  if (report.sendStderr) console.log('Stderr:', report.sendStderr);
}

main();
