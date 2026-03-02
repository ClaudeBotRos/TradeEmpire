#!/usr/bin/env node
/**
 * TradeEmpire — Séquence matin : TECHNICALS → SMART_MONEY → SENTIMENT → ORCHESTRATOR → RISK_JOURNAL
 * Chaque étape enregistre un échange dans data/dashboard/agent_exchanges.json (Wire).
 * Usage: node scripts/run-morning.js
 * Depuis la racine trading-empire/ ou workspace (node TradeEmpire/trading-empire/scripts/run-morning.js)
 */

const { execSync } = require('child_process');
const path = require('path');
const { appendWire } = require('./wire-log.js');

const ROOT = path.join(__dirname, '..');
const STEPS = [
  { script: 'economic-calendar-scan.js', from: 'INTEL', to: 'ORCHESTRATOR', summary: 'Calendrier économique (dates/heures clés, actuals).', ref: 'data/dashboard/intel/economic_calendar.json' },
  { script: 'intel-scan.js', from: 'INTEL', to: 'ORCHESTRATOR', summary: 'Trend Cards X + YouTube + macro (narrative du jour pour orchestrator).', ref: 'data/dashboard/intel/trend_cards.json' },
  { script: 'technicals-scan.js', from: 'TECHNICALS', to: 'ORCHESTRATOR', summary: 'Signaux techniques (OHLCV, trend, levels) écrits.', ref: 'data/signals/technicals/' },
  { script: 'smart-money-scan.js', from: 'SMART_MONEY', to: 'ORCHESTRATOR', summary: 'Signaux smart money (funding) écrits.', ref: 'data/signals/smart_money/' },
  { script: 'sentiment-scan.js', from: 'SENTIMENT_X', to: 'ORCHESTRATOR', summary: 'Signaux sentiment (narratives X) écrits.', ref: 'data/signals/sentiment/' },
  { script: 'orchestrator-scan.js', from: 'ORCHESTRATOR', to: 'RISK_JOURNAL', summary: 'Idées TRADE_IDEA produites à partir des signaux.', ref: 'data/ideas/' },
  { script: 'build-niches-fiches.js', from: 'ORCHESTRATOR', to: 'BROADCAST', summary: 'Fiches Niches scorées mises à jour.', ref: 'data/dashboard/niches/' },
  { script: 'risk-journal-scan.js', from: 'RISK_JOURNAL', to: 'BROADCAST', summary: 'Décisions (APPROVED/REJECTED) et journal du jour écrits.', ref: 'data/decisions/ et data/journal/' },
];

console.log('TradeEmpire run-morning — start');
for (const step of STEPS) {
  const scriptPath = path.join(__dirname, step.script);
  console.log('Running', step.script, '...');
  try {
    execSync(`node "${scriptPath}"`, { encoding: 'utf8', cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error(step.script, 'failed:', e.message);
    process.exit(1);
  }
  appendWire({
    from_agent: step.from,
    to_agent: step.to,
    type: 'SHARE_SIGNAL',
    context: { window: 'morning_brief' },
    content_summary: step.summary,
    content_ref: step.ref,
  });
}
console.log('TradeEmpire run-morning — done');
