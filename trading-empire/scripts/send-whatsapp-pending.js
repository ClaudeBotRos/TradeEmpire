#!/usr/bin/env node
/**
 * TradeEmpire — Consomme la file whatsapp_pending.json et envoie chaque message via OpenClaw (WhatsApp).
 * À lancer régulièrement (cron) pour que les messages des agents (Scout, Chase, etc.) arrivent sur WhatsApp.
 * Usage: node scripts/send-whatsapp-pending.js
 * Env: WHATSAPP_TO (défaut +33625174653), WHATSAPP_ACCOUNT (défaut custom-1).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'data', 'notifications', 'whatsapp_pending.json');

const TO = process.env.WHATSAPP_TO || '+33625174653';
const ACCOUNT = process.env.WHATSAPP_ACCOUNT || 'custom-1';

function main() {
  if (!fs.existsSync(QUEUE_FILE)) {
    console.log(JSON.stringify({ ok: true, sent: 0, remaining: 0 }));
    return;
  }

  let queue;
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    queue = JSON.parse(raw);
    if (!Array.isArray(queue)) queue = [];
  } catch (_) {
    console.log(JSON.stringify({ ok: true, sent: 0, remaining: 0 }));
    return;
  }

  if (queue.length === 0) {
    console.log(JSON.stringify({ ok: true, sent: 0, remaining: 0 }));
    return;
  }

  const remaining = [];
  let sent = 0;

  for (const entry of queue) {
    const msg = (entry.message || '').trim();
    if (!msg) {
      remaining.push(entry);
      continue;
    }
    try {
      execFileSync(
        'openclaw',
        ['message', 'send', '--channel', 'whatsapp', '-t', TO, '--account', ACCOUNT, '-m', msg],
        { encoding: 'utf8', stdio: 'pipe', timeout: 30000 }
      );
      sent++;
    } catch (e) {
      console.warn('send-whatsapp-pending: envoi échoué:', e.message || e);
      remaining.push(entry);
    }
  }

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(remaining, null, 2), 'utf8');
  console.log(JSON.stringify({ ok: true, sent, remaining: remaining.length }));
}

main();
