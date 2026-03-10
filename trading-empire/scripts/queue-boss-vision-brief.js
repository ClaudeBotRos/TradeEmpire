#!/usr/bin/env node
/**
 * TradeEmpire — Met en file WhatsApp le contenu de boss_expansion_proposals.md (BOSS vision).
 * À lancer après que l’agent a exécuté boss-vision.js et écrit boss_expansion_proposals.md.
 * Ainsi le résumé BOSS vision est envoyé via send-whatsapp-pending (la livraison cron « announce » ne fonctionne pas).
 * Usage: node scripts/queue-boss-vision-brief.js
 */

const fs = require('fs');
const path = require('path');
const { pushToQueue } = require('./whatsapp-queue-push.js');

const ROOT = path.join(__dirname, '..');
const PROPOSALS_PATH = path.join(ROOT, 'data', 'dashboard', 'boss_expansion_proposals.md');
const MIN_LENGTH = 20;

function main() {
  if (!fs.existsSync(PROPOSALS_PATH)) {
    console.log(JSON.stringify({ ok: true, queued: false, reason: 'no_file' }));
    return;
  }
  const raw = fs.readFileSync(PROPOSALS_PATH, 'utf8').trim();
  if (raw.length < MIN_LENGTH) {
    console.log(JSON.stringify({ ok: true, queued: false, reason: 'file_empty_or_too_short' }));
    return;
  }
  pushToQueue('boss', `Vision / expansion\n\n${raw}`);
  console.log(JSON.stringify({ ok: true, queued: true, length: raw.length }));
}

main();
