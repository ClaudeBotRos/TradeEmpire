#!/usr/bin/env node
/**
 * TradeEmpire — Récap du soir (post journal).
 * Lit décisions et journal du jour, produit un récap pour la notification (canal unique WhatsApp).
 * Écrit data/journal/{date}_evening_brief.md et affiche le récap sur stdout.
 * Usage: node scripts/evening-brief.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DECISIONS_DIR = path.join(ROOT, 'data', 'decisions');
const JOURNAL_DIR = path.join(ROOT, 'data', 'journal');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');

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
  const decisions = loadJsonDir(DECISIONS_DIR).filter((d) => isToday(d.timestamp_utc));
  const approved = decisions.filter((d) => d.status === 'APPROVED');
  const rejected = decisions.filter((d) => d.status === 'REJECTED');
  const ideas = loadJsonDir(IDEAS_DIR).filter((i) => isToday(i.timestamp_utc));

  const lines = [];
  lines.push(`TradeEmpire — Récap soir ${date}`);
  lines.push('');
  lines.push(`Idées du jour : ${ideas.length} | APPROVED : ${approved.length} | REJECTED : ${rejected.length}`);
  if (approved.length) {
    lines.push(`Approuvées : ${approved.map((d) => d.trade_id || '—').slice(0, 3).join(', ')}${approved.length > 3 ? '…' : ''}`);
  }
  lines.push('');
  lines.push('Journal et détails : data/journal/ — Dashboard : Wire, décisions, Chase (post-mortem).');

  const briefText = lines.join('\n');
  if (!fs.existsSync(JOURNAL_DIR)) fs.mkdirSync(JOURNAL_DIR, { recursive: true });
  const briefPath = path.join(JOURNAL_DIR, `${date}_evening_brief.md`);
  const mdContent = `# Récap soir ${date}\n\n${briefText.replace(/\n/g, '\n\n')}\n\n---\n*Généré par evening-brief.js pour notification canal unique.*\n`;
  fs.writeFileSync(briefPath, mdContent, 'utf8');

  console.log(briefText);
}

main();
