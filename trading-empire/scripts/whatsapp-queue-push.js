/**
 * TradeEmpire — Mise en file WhatsApp (helper partagé).
 * Utilisé par notify-user-whatsapp.js, morning-brief.js, evening-brief.js, etc.
 * La file est data/notifications/whatsapp_pending.json (consommée par send-whatsapp-pending.js).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NOTIF_DIR = path.join(ROOT, 'data', 'notifications');
const QUEUE_FILE = path.join(NOTIF_DIR, 'whatsapp_pending.json');

const AGENT_LABELS = {
  chase: 'Chase',
  intel: 'Daphnée (Intel)',
  orchestrator: 'Orchestrator',
  risk_journal: 'Risk Journal',
  technicals: 'Alicia (Technicals)',
  sentiment_x: 'Sentiment X',
  smart_money: 'Lucas (Smart Money)',
  tibo: 'Tibo',
  boss: 'BOSS',
  opportunity_scout: 'Scout',
  recovery_analyst: 'Recovery',
};

/**
 * Ajoute un message à la file WhatsApp (même format que notify-user-whatsapp).
 * @param {string} agentId - ex. 'orchestrator', 'boss', 'risk_journal'
 * @param {string} message - texte à envoyer (peut déjà contenir [Label] en préfixe)
 * @returns {{ ok: boolean, queued: number, total: number }}
 */
function pushToQueue(agentId, message) {
  if (!fs.existsSync(NOTIF_DIR)) {
    fs.mkdirSync(NOTIF_DIR, { recursive: true });
  }
  let queue = [];
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      if (!Array.isArray(queue)) queue = [];
    } catch (_) {
      queue = [];
    }
  }
  const label = AGENT_LABELS[agentId] || agentId;
  const text = (message || '').trim();
  const messageWithSender = text.startsWith('[') ? text : `[${label}] ${text}`;
  queue.push({
    agentId,
    message: messageWithSender,
    createdAt: new Date().toISOString(),
  });
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
  return { ok: true, queued: 1, total: queue.length };
}

module.exports = { pushToQueue, QUEUE_FILE, NOTIF_DIR };
