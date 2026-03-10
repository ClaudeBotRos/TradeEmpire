#!/usr/bin/env node
/**
 * TradeEmpire — Statut de validation des propositions Scout.
 * Croise scout_proposals.json avec les décisions APPROVED (hors expired) et executed_orders.
 * Tu peux voir quelles propositions ont été validées (idée approuvée) ou exécutées (ordre passé).
 * Usage: node scripts/scout-validation-status.js [--md]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCOUT_PROPOSALS_PATH = path.join(ROOT, 'data', 'dashboard', 'scout_proposals.json');
const DECISIONS_DIR = path.join(ROOT, 'data', 'decisions');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const EXECUTED_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');
const STATUS_PATH = path.join(ROOT, 'data', 'dashboard', 'scout_validation_status.json');
const REPORTS_DIR = path.join(ROOT, 'data', 'reports');

function loadScoutProposals() {
  if (!fs.existsSync(SCOUT_PROPOSALS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SCOUT_PROPOSALS_PATH, 'utf8'));
  } catch (_) {
    return null;
  }
}

function getApprovedSymbols() {
  const symbols = new Set();
  if (!fs.existsSync(DECISIONS_DIR)) return symbols;
  const files = fs.readdirSync(DECISIONS_DIR).filter((f) => f.endsWith('_APPROVED.json'));
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DECISIONS_DIR, f), 'utf8'));
      if (!data.trade_id) continue;
      const m = data.trade_id.match(/^idea_([A-Z0-9]+)_/i);
      if (m) symbols.add(m[1].toUpperCase());
    } catch (_) {}
  }
  return symbols;
}

function getExecutedSymbols() {
  const symbols = new Set();
  if (!fs.existsSync(EXECUTED_PATH)) return symbols;
  try {
    const data = JSON.parse(fs.readFileSync(EXECUTED_PATH, 'utf8'));
    const list = Array.isArray(data) ? data : [];
    for (const e of list) {
      if (e.symbol) symbols.add(String(e.symbol).toUpperCase());
    }
  } catch (_) {}
  return symbols;
}

function main() {
  const scout = loadScoutProposals();
  const approvedSymbols = getApprovedSymbols();
  const executedSymbols = getExecutedSymbols();

  const proposals = (scout && Array.isArray(scout.proposals)) ? scout.proposals : [];
  const bySymbol = [];

  for (const p of proposals) {
    const sym = (p.symbol || '').toUpperCase();
    if (!sym) continue;
    let status = 'proposed_only';
    let detail = 'Proposé par Scout, pas encore validé.';
    if (executedSymbols.has(sym)) {
      status = 'executed';
      detail = 'Au moins un ordre a été passé sur ce symbole (executed_orders).';
    } else if (approvedSymbols.has(sym)) {
      status = 'approved';
      detail = 'Idée approuvée (Risk Journal), ordre pas encore exécuté ou en attente.';
    }
    bySymbol.push({
      symbol: sym,
      reason: p.reason,
      source: p.source,
      status,
      detail,
    });
  }

  const report = {
    timestamp_utc: new Date().toISOString(),
    scout_proposals_at: scout ? scout.timestamp_utc : null,
    summary: `${bySymbol.filter((x) => x.status === 'executed').length} exécuté(s), ${bySymbol.filter((x) => x.status === 'approved').length} approuvé(s), ${bySymbol.filter((x) => x.status === 'proposed_only').length} proposé(s) uniquement.`,
    by_symbol: bySymbol,
  };

  const dashDir = path.dirname(STATUS_PATH);
  if (!fs.existsSync(dashDir)) fs.mkdirSync(dashDir, { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log('Scout validation status written to', STATUS_PATH);

  if (process.argv.includes('--md')) {
    const date = new Date().toISOString().slice(0, 10);
    const mdPath = path.join(REPORTS_DIR, `${date}_scout_validation.md`);
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    let md = `# Scout — Statut de validation — ${date}\n\n`;
    md += `${report.summary}\n\n| Symbole | Statut | Détail |\n|---------|--------|--------|\n`;
    for (const x of bySymbol) {
      md += `| ${x.symbol} | **${x.status}** | ${(x.detail || '').replace(/\|/g, ' ')} |\n`;
    }
    fs.writeFileSync(mdPath, md, 'utf8');
    console.log('Scout validation (MD) written to', mdPath);
  }

  console.log(JSON.stringify({ ok: true, summary: report.summary, file: STATUS_PATH }));
}

main();
