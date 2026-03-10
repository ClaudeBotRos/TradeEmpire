#!/usr/bin/env node
/**
 * TradeEmpire — Chaîne Scout + Validation + Recovery intraday + envoi WhatsApp.
 * À lancer manuellement ou via cron pour tout enchaîner ; à la fin les messages
 * en file WhatsApp sont envoyés (pas seulement déposés).
 * Usage: node scripts/run-scout-recovery-chain.js [--no-whatsapp pour Scout]
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const noWhatsApp = process.argv.includes('--no-whatsapp');

function run(name, cmd) {
  console.log('[chain]', name);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', timeout: 120000 });
  } catch (e) {
    console.error('[chain]', name, 'failed:', e.message || e);
    process.exit(1);
  }
}

run('Scout', `node scripts/opportunity-scout.js ${noWhatsApp ? '--no-whatsapp' : ''}`);
run('Scout validation status', 'node scripts/scout-validation-status.js --md');
run('Recovery intraday', 'node scripts/recovery-intraday-review.js --md --apply-cancel');
run('Envoi file WhatsApp', 'node scripts/send-whatsapp-pending.js');
console.log('[chain] Done.');
