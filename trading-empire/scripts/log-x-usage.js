#!/usr/bin/env node
/**
 * Enregistre un appel à l'API X (Twitter) pour le calcul des coûts.
 * Utilisé par intel-scan.js, sentiment-scan.js, agent-status-report.js.
 * Les entrées sont agrégées par cost-api-update.js pour costs.json.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const USAGE_FILE = path.join(ROOT, 'data', 'dashboard', 'usage_x.json');
const MAX_ENTRIES = 5000;

/**
 * @param {number} [requests=1] - Nombre de requêtes API (généralement 1 par appel).
 * @param {number} [tweetsCount=0] - Nombre de tweets retournés (pour info).
 */
function logXUsage(requests = 1, tweetsCount = 0) {
  const dir = path.dirname(USAGE_FILE);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {
      return;
    }
  }
  const entry = {
    ts: new Date().toISOString(),
    requests: Math.max(1, Math.floor(requests)),
    tweets_count: Math.max(0, Math.floor(tweetsCount)),
  };
  let list = [];
  if (fs.existsSync(USAGE_FILE)) {
    try {
      const raw = fs.readFileSync(USAGE_FILE, 'utf8');
      list = JSON.parse(raw);
      if (!Array.isArray(list)) list = [];
    } catch (_) {
      list = [];
    }
  }
  list.push(entry);
  if (list.length > MAX_ENTRIES) {
    list = list.slice(-MAX_ENTRIES);
  }
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(list, null, 0), 'utf8');
  } catch (_) {}
}

module.exports = { logXUsage };
