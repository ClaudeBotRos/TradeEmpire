#!/usr/bin/env node
/**
 * TradeEmpire — Mise en file d’un message WhatsApp pour l’utilisateur.
 * Chaque agent peut appeler ce script pour signaler un message important.
 * La file est data/notifications/whatsapp_pending.json (consommée par un cron/OpenClaw).
 * Usage: node scripts/notify-user-whatsapp.js <agentId> "<message>"
 *   ou:  AGENT_ID=chase NOTIFY_MESSAGE="Alerte ..." node scripts/notify-user-whatsapp.js
 */

const { pushToQueue } = require('./whatsapp-queue-push.js');

function main() {
  const agentId = process.env.AGENT_ID || process.argv[2];
  const message = process.env.NOTIFY_MESSAGE || (process.argv.length > 3 ? process.argv.slice(3).join(' ') : process.argv[2] || '');
  const msgText = (typeof message === 'string' ? message : '').trim();

  if (!agentId || !msgText) {
    console.error('Usage: node notify-user-whatsapp.js <agentId> "<message>"');
    console.error('   or: AGENT_ID=chase NOTIFY_MESSAGE="..." node notify-user-whatsapp.js');
    process.exit(1);
  }

  const result = pushToQueue(agentId, msgText);
  console.log(JSON.stringify(result));
}

main();
