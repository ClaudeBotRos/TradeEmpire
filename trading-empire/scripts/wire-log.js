#!/usr/bin/env node
/**
 * TradeEmpire — Enregistrement d’un échange dans data/dashboard/agent_exchanges.json (module Wire).
 * Usage: require('./wire-log.js').appendWire(...) depuis un script, ou node wire-log.js pour test.
 * Format PRD §6.12 : id, timestamp_utc, from_agent, to_agent, type, context, content_summary, content_ref.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WIRE_FILE = path.join(ROOT, 'data', 'dashboard', 'agent_exchanges.json');
const MAX_ENTRIES = 500;

const AGENTS = ['BOSS', 'ORCHESTRATOR', 'SENTIMENT_X', 'SMART_MONEY', 'TECHNICALS', 'RISK_JOURNAL', 'INTEL', 'CHASE'];
const TYPES = ['REQUEST', 'RESPONSE', 'SHARE_SIGNAL', 'BROADCAST'];

function appendWire(entry) {
  const dir = path.dirname(WIRE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const id = entry.id || `wire-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15)}-${(entry.from_agent || 'unknown').toLowerCase()}`;
  const timestampUtc = entry.timestamp_utc || new Date().toISOString();
  const record = {
    id,
    timestamp_utc: timestampUtc,
    from_agent: entry.from_agent || 'UNKNOWN',
    to_agent: entry.to_agent != null ? entry.to_agent : 'BROADCAST',
    type: TYPES.includes(entry.type) ? entry.type : 'SHARE_SIGNAL',
    context: entry.context || {},
    content_summary: entry.content_summary || '',
    content_ref: entry.content_ref || null,
  };

  let list = [];
  if (fs.existsSync(WIRE_FILE)) {
    try {
      const raw = fs.readFileSync(WIRE_FILE, 'utf8');
      const data = JSON.parse(raw);
      list = Array.isArray(data) ? data : [];
    } catch (_) {
      list = [];
    }
  }
  list.push(record);
  if (list.length > MAX_ENTRIES) {
    list = list.slice(-MAX_ENTRIES);
  }
  fs.writeFileSync(WIRE_FILE, JSON.stringify(list, null, 2), 'utf8');
  return record;
}

if (require.main === module) {
  appendWire({
    from_agent: 'TECHNICALS',
    to_agent: 'ORCHESTRATOR',
    type: 'SHARE_SIGNAL',
    content_summary: 'Test wire-log',
    content_ref: 'data/signals/technicals/',
  });
  console.log('OK wire entry written');
} else {
  module.exports = { appendWire, WIRE_FILE };
}
