#!/usr/bin/env node
/**
 * TradeEmpire — Diagnostic des pertes Chase.
 * Analyse les outcomes avec outcome === 'loss' : agrège par symbole, direction, idées associées,
 * et produit un rapport (causes communes : signaux défaillants, timing, conditions marché).
 * Écrit data/dashboard/chase_loss_diagnostic.json et chase_loss_diagnostic.md.
 * Appelé automatiquement par chase-tracker.js à chaque run ; peut aussi être lancé seul.
 * Usage: node scripts/chase-loss-diagnostic.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTCOMES_DIR = path.join(ROOT, 'data', 'tracker', 'outcomes');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const DASHBOARD_DIR = path.join(ROOT, 'data', 'dashboard');
const DIAG_JSON = path.join(DASHBOARD_DIR, 'chase_loss_diagnostic.json');
const DIAG_MD = path.join(DASHBOARD_DIR, 'chase_loss_diagnostic.md');

function loadIdea(tradeId) {
  const p = path.join(IDEAS_DIR, `${tradeId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function loadOutcome(fileName) {
  const p = path.join(OUTCOMES_DIR, fileName);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function symbolFromTradeId(tid) {
  const m = (tid || '').match(/^idea_([A-Z0-9]+)_\d+$/i);
  return m ? m[1] : null;
}

function runDiagnostic() {
  if (!fs.existsSync(OUTCOMES_DIR)) {
    fs.mkdirSync(path.dirname(OUTCOMES_DIR), { recursive: true });
    writeEmptyReport();
    return;
  }

  const files = fs.readdirSync(OUTCOMES_DIR).filter((f) => f.endsWith('.json'));
  const losses = [];
  for (const f of files) {
    const data = loadOutcome(f);
    if (!data || data.outcome !== 'loss') continue;
    const tradeId = data.trade_id || f.replace('.json', '');
    const idea = loadIdea(tradeId);
    losses.push({
      trade_id: tradeId,
      symbol: data.symbol || symbolFromTradeId(tradeId),
      direction: data.direction || idea?.direction,
      entry: data.entry ?? idea?.entry?.price,
      exit_price: data.exit_price,
      invalid: data.invalid ?? idea?.invalid?.price,
      closed_at: data.closed_at,
      note: data.note,
      confidence: idea?.confidence,
      timeframe: idea?.timeframe,
      setup_name: idea?.setup_name,
      evidence: idea?.evidence,
    });
  }

  const bySymbol = {};
  const byDirection = { LONG: 0, SHORT: 0 };
  const byTimeframe = {};
  const confidenceSum = { sum: 0, count: 0 };

  for (const l of losses) {
    const sym = l.symbol || 'UNKNOWN';
    bySymbol[sym] = (bySymbol[sym] || 0) + 1;
    if (l.direction === 'LONG' || l.direction === 'SHORT') byDirection[l.direction]++;
    const tf = l.timeframe || '?';
    byTimeframe[tf] = (byTimeframe[tf] || 0) + 1;
    if (typeof l.confidence === 'number') {
      confidenceSum.sum += l.confidence;
      confidenceSum.count += 1;
    }
  }

  const symbolsByCount = Object.entries(bySymbol)
    .sort((a, b) => b[1] - a[1])
    .map(([s, c]) => ({ symbol: s, loss_count: c }));

  const avgConfidence = confidenceSum.count > 0 ? (confidenceSum.sum / confidenceSum.count).toFixed(2) : null;

  const report = {
    timestamp_utc: new Date().toISOString(),
    total_losses: losses.length,
    by_symbol: symbolsByCount,
    by_direction: byDirection,
    by_timeframe: byTimeframe,
    avg_confidence_losses: avgConfidence,
    losses: losses.map((l) => ({
      trade_id: l.trade_id,
      symbol: l.symbol,
      direction: l.direction,
      closed_at: l.closed_at,
      entry: l.entry,
      exit_price: l.exit_price,
      invalid: l.invalid,
      confidence: l.confidence,
      setup_name: l.setup_name,
    })),
    possible_causes: [
      losses.length === 0
        ? 'Aucune perte enregistrée.'
        : 'Signaux défaillants : vérifier les idées à faible confidence ou setup récurrent en perte.',
      symbolsByCount.length ? `Symboles les plus touchés : ${symbolsByCount.slice(0, 5).map((x) => x.symbol).join(', ')} — renforcer les filtres ou le risk sur ces paires.` : '',
      'Timing : entrées trop précoces ou invalidation trop serrée (entry vs invalid).',
      'Conditions marché : tendance contraire (LONG en baisse, SHORT en hausse) — aligner avec Intel/technicals.',
    ].filter(Boolean),
    recommendations: [
      losses.length === 0
        ? 'Continuer le suivi ; le diagnostic se met à jour à chaque run Chase.'
        : 'Réviser les signaux (TECHNICALS, SMART_MONEY, SENTIMENT_X) sur les paires avec le plus de pertes.',
      symbolsByCount.length ? 'Envisager un cooldown ou un levier réduit sur les symboles à pertes répétées.' : '',
      'Consulter les post-mortems (data/tracker/post_mortem/YYYY-MM-DD.md) pour le détail par trade.',
    ].filter(Boolean),
  };

  if (!fs.existsSync(DASHBOARD_DIR)) fs.mkdirSync(DASHBOARD_DIR, { recursive: true });
  fs.writeFileSync(DIAG_JSON, JSON.stringify(report, null, 2), 'utf8');

  const tableRows = report.by_symbol.length
    ? ['| Symbole | Nombre de pertes |', '|---------|------------------|', ...report.by_symbol.map((x) => `| ${x.symbol} | ${x.loss_count} |`)]
    : ['*Aucun.*'];
  const mdLines = [
    '# Diagnostic des pertes — Chase',
    '',
    `*Généré le ${report.timestamp_utc}*`,
    '',
    '## Synthèse',
    '',
    `- **Nombre de pertes** : ${report.total_losses}`,
    ...(avgConfidence != null ? [`- **Confiance moyenne (trades perdants)** : ${avgConfidence}`] : []),
    '',
    '## Par symbole',
    '',
    ...tableRows,
    '',
    '## Par direction',
    '',
    `- LONG : ${report.by_direction.LONG || 0}`,
    `- SHORT : ${report.by_direction.SHORT || 0}`,
    '',
    '## Causes possibles',
    '',
    ...report.possible_causes.map((c) => `- ${c}`),
    '',
    '## Recommandations',
    '',
    ...report.recommendations.map((r) => `- ${r}`),
    '',
    '---',
    '',
    '*Source : outcomes avec outcome=loss. Détail dans data/tracker/outcomes/ et data/tracker/post_mortem/.*',
  ];

  fs.writeFileSync(DIAG_MD, mdLines.join('\n'), 'utf8');
  console.log('Chase loss diagnostic:', report.total_losses, 'loss(es) |', DIAG_JSON, '|', DIAG_MD);
}

function writeEmptyReport() {
  const report = {
    timestamp_utc: new Date().toISOString(),
    total_losses: 0,
    by_symbol: [],
    by_direction: { LONG: 0, SHORT: 0 },
    by_timeframe: {},
    possible_causes: ['Aucune perte enregistrée.'],
    recommendations: ['Le diagnostic se met à jour à chaque run de chase-tracker.js.'],
  };
  if (!fs.existsSync(DASHBOARD_DIR)) fs.mkdirSync(DASHBOARD_DIR, { recursive: true });
  fs.writeFileSync(DIAG_JSON, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(DIAG_MD, '# Diagnostic des pertes — Chase\n\n*Aucune perte enregistrée.*\n', 'utf8');
  console.log('Chase loss diagnostic: 0 losses |', DIAG_JSON);
}

function main() {
  runDiagnostic();
}

if (require.main === module) {
  main();
}

module.exports = { runDiagnostic };
