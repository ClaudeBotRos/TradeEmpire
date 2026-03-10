#!/usr/bin/env node
/**
 * TradeEmpire — Recovery Analyst : lit les outcomes Chase, agrège par symbole et par cause, produit un rapport.
 * Pour alimenter le BOSS et le dashboard.
 * Usage: node scripts/recovery-analyst-report.js [--md]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTCOMES_DIR = path.join(ROOT, 'data', 'tracker', 'outcomes');
const REPORT_JSON_PATH = path.join(ROOT, 'data', 'dashboard', 'recovery_report.json');
const REPORTS_DIR = path.join(ROOT, 'data', 'reports');

const OUTCOME_TYPES = ['win', 'loss', 'invalid_hit', 'target_hit', 'revoked'];

function symbolFromTradeId(tradeId) {
  if (!tradeId || typeof tradeId !== 'string') return null;
  const m = tradeId.match(/^idea_([A-Z0-9]+)_\d+$/i);
  return m ? m[1].toUpperCase() : null;
}

function loadAllOutcomes() {
  if (!fs.existsSync(OUTCOMES_DIR)) return [];
  const files = fs.readdirSync(OUTCOMES_DIR).filter((f) => f.endsWith('.json'));
  const list = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(OUTCOMES_DIR, f), 'utf8'));
      const outcome = (data.outcome || '').toLowerCase().trim();
      if (!outcome || outcome === 'pending') continue;
      if (!OUTCOME_TYPES.includes(outcome)) continue;
      const symbol = data.symbol || symbolFromTradeId(data.trade_id || f.replace('.json', ''));
      list.push({
        trade_id: data.trade_id || f.replace('.json', ''),
        symbol: symbol ? symbol.toUpperCase() : null,
        outcome,
        closed_at: data.closed_at || null,
        note: data.note || null,
        direction: data.direction || null,
        entry: data.entry,
        exit_price: data.exit_price,
      });
    } catch (_) {}
  }
  return list;
}

function buildReport(outcomes) {
  const by_symbol = {};
  const by_outcome = { win: 0, loss: 0, invalid_hit: 0, target_hit: 0, revoked: 0 };

  for (const o of outcomes) {
    by_outcome[o.outcome] = (by_outcome[o.outcome] || 0) + 1;
    const sym = o.symbol || 'UNKNOWN';
    if (!by_symbol[sym]) {
      by_symbol[sym] = { win: 0, loss: 0, invalid_hit: 0, target_hit: 0, revoked: 0, total: 0, trades: [] };
    }
    by_symbol[sym][o.outcome]++;
    by_symbol[sym].total++;
    by_symbol[sym].trades.push({
      trade_id: o.trade_id,
      outcome: o.outcome,
      closed_at: o.closed_at,
      direction: o.direction,
    });
  }

  const total = outcomes.length;
  const lossCount = by_outcome.loss + by_outcome.invalid_hit;
  const winCount = by_outcome.win + by_outcome.target_hit;
  const summary = total === 0
    ? 'Aucun outcome complété.'
    : `${total} trade(s) clôturés : ${winCount} gagnant(s) (win+target_hit), ${lossCount} perdant(s) (loss+invalid_hit). Par symbole : voir by_symbol.`;

  return {
    timestamp_utc: new Date().toISOString(),
    total_outcomes: total,
    by_outcome,
    by_symbol,
    summary,
  };
}

function writeMarkdownReport(report) {
  const date = new Date().toISOString().slice(0, 10);
  const mdPath = path.join(REPORTS_DIR, `${date}_recovery.md`);
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  let md = `# Rapport Recovery (Chase outcomes) — ${date}\n\n`;
  md += `Généré le ${report.timestamp_utc}\n\n`;
  md += `## Synthèse\n\n${report.summary}\n\n`;
  md += `## Par type d'outcome\n\n`;
  md += `| Type | Nombre |\n|------|--------|\n`;
  for (const [k, v] of Object.entries(report.by_outcome)) {
    md += `| ${k} | ${v} |\n`;
  }
  md += `\n## Par symbole\n\n`;
  const symbols = Object.keys(report.by_symbol).sort();
  md += `| Symbole | win | loss | invalid_hit | target_hit | revoked | total |\n|---------|-----|------|-------------|------------|--------|-------|\n`;
  for (const sym of symbols) {
    const s = report.by_symbol[sym];
    md += `| ${sym} | ${s.win || 0} | ${s.loss || 0} | ${s.invalid_hit || 0} | ${s.target_hit || 0} | ${s.revoked || 0} | ${s.total} |\n`;
  }
  md += `\n---\n*Source : data/tracker/outcomes/*.json (Chase)*\n`;

  fs.writeFileSync(mdPath, md, 'utf8');
  console.log('Recovery report (MD) written to', mdPath);
  return mdPath;
}

function main() {
  const outcomes = loadAllOutcomes();
  const report = buildReport(outcomes);

  const dashDir = path.dirname(REPORT_JSON_PATH);
  if (!fs.existsSync(dashDir)) fs.mkdirSync(dashDir, { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log('Recovery report (JSON) written to', REPORT_JSON_PATH);

  try {
    const { appendWire } = require('./wire-log.js');
    appendWire({
      from_agent: 'RECOVERY_ANALYST',
      to_agent: 'BOSS',
      type: 'SHARE_SIGNAL',
      context: { window: 'recovery_report' },
      content_summary: report.summary || `${report.total_outcomes} outcome(s) agrégés.`,
      content_ref: 'data/dashboard/recovery_report.json',
    });
  } catch (_) {}

  const wantMd = process.argv.includes('--md') || process.env.RECOVERY_REPORT_MD === '1';
  if (wantMd) writeMarkdownReport(report);

  console.log(JSON.stringify({
    ok: true,
    total_outcomes: report.total_outcomes,
    file: REPORT_JSON_PATH,
    summary: report.summary,
  }));
}

main();
