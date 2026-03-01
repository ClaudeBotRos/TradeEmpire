#!/usr/bin/env node
/**
 * TradeEmpire — Brief du matin (ORCHESTRATOR).
 * Lit idées, décisions et journal du jour, produit un résumé pour la notification (canal unique).
 * Écrit data/journal/{date}_brief.md (PRD §4.4) et affiche le brief sur stdout (pour envoi WhatsApp/Telegram).
 * Usage: node scripts/morning-brief.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const DECISIONS_DIR = path.join(ROOT, 'data', 'decisions');
const JOURNAL_DIR = path.join(ROOT, 'data', 'journal');

function loadJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    } catch (_) {}
  }
  return out;
}

function isToday(isoStr) {
  if (!isoStr) return false;
  const d = new Date().toISOString().slice(0, 10);
  return isoStr.slice(0, 10) === d;
}

function main() {
  const date = new Date().toISOString().slice(0, 10);
  const ideas = loadJsonDir(IDEAS_DIR).filter((i) => isToday(i.timestamp_utc));
  const decisions = loadJsonDir(DECISIONS_DIR).filter((d) => isToday(d.timestamp_utc));
  const approved = decisions.filter((d) => d.status === 'APPROVED');
  const rejected = decisions.filter((d) => d.status === 'REJECTED');
  const needMore = decisions.filter((d) => d.status === 'NEED_MORE_INFO');

  const lines = [];
  lines.push(`TradeEmpire — Brief ${date}`);
  lines.push('');
  lines.push(`Idées : ${ideas.length} | APPROVED : ${approved.length} | REJECTED : ${rejected.length}${needMore.length ? ` | NEED_MORE_INFO : ${needMore.length}` : ''}`);
  if (approved.length) {
    const syms = [...new Set(approved.map((d) => (d.trade_id && d.trade_id.split('_')[1]) || '').filter(Boolean))];
    lines.push(`Approuvées : ${syms.slice(0, 5).join(', ')}${syms.length > 5 ? '…' : ''}`);
  }
  if (rejected.length) {
    lines.push(`Refusées : ${rejected.length}`);
  }
  lines.push('');
  lines.push('Journal et détails : data/journal/ — Dashboard : signaux, Wire, idées.');

  const briefText = lines.join('\n');
  const briefPath = path.join(JOURNAL_DIR, `${date}_brief.md`);
  if (!fs.existsSync(JOURNAL_DIR)) fs.mkdirSync(JOURNAL_DIR, { recursive: true });
  const mdContent = `# Brief du jour ${date}\n\n${briefText.replace(/\n/g, '\n\n')}\n\n---\n*Généré par morning-brief.js pour notification canal unique (ORCHESTRATOR).*\n`;
  fs.writeFileSync(briefPath, mdContent, 'utf8');

  console.log(briefText);
}

main();
