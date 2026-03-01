#!/usr/bin/env node
/**
 * TradeEmpire — Chase (Tracker) : suit les idées APPROVED, post-mortem et feedback aux agents.
 * 1) Sync idées APPROVED → data/tracker/outcomes/ (pending si absent).
 * 2) Pour chaque outcome complété (win/loss/invalid_hit/target_hit), génère post_mortem.
 * 3) Agrège feedback par agent dans data/tracker/feedback/.
 * Usage: node scripts/chase-tracker.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DECISIONS_DIR = path.join(ROOT, 'data', 'decisions');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const OUTCOMES_DIR = path.join(ROOT, 'data', 'tracker', 'outcomes');
const POST_MORTEM_DIR = path.join(ROOT, 'data', 'tracker', 'post_mortem');
const FEEDBACK_DIR = path.join(ROOT, 'data', 'tracker', 'feedback');

function loadJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function loadIdea(tradeId) {
  const p = path.join(IDEAS_DIR, `${tradeId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function main() {
  [OUTCOMES_DIR, POST_MORTEM_DIR, FEEDBACK_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const decisions = loadJsonDir(DECISIONS_DIR).filter((d) => d.status === 'APPROVED');
  let synced = 0;
  for (const dec of decisions) {
    const tradeId = dec.trade_id;
    if (!tradeId) continue;
    const outPath = path.join(OUTCOMES_DIR, `${tradeId}.json`);
    if (fs.existsSync(outPath)) continue;
    const idea = loadIdea(tradeId);
    const outcome = {
      trade_id: tradeId,
      outcome: 'pending',
      approved_at: dec.timestamp_utc,
      symbol: idea?.symbol,
      direction: idea?.direction,
      entry: idea?.entry?.price,
      invalid: idea?.invalid?.price,
      targets: idea?.targets,
      note: 'Remplir outcome (win|loss|invalid_hit|target_hit), optionnel: exit_price, closed_at, note.',
    };
    fs.writeFileSync(outPath, JSON.stringify(outcome, null, 2), 'utf8');
    synced++;
  }
  if (synced) console.log('Chase: synced', synced, 'approved ideas to outcomes (pending).');

  const outcomeFiles = fs.existsSync(OUTCOMES_DIR) ? fs.readdirSync(OUTCOMES_DIR).filter((f) => f.endsWith('.json')) : [];
  const postMortems = [];
  for (const f of outcomeFiles) {
    const outPath = path.join(OUTCOMES_DIR, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    } catch (_) {
      continue;
    }
    if (data.outcome === 'pending' || !data.outcome) continue;
    const tradeId = data.trade_id || f.replace('.json', '');
    const pmPath = path.join(POST_MORTEM_DIR, `${tradeId}.md`);
    if (fs.existsSync(pmPath)) {
      try {
        postMortems.push({ trade_id: tradeId, content: fs.readFileSync(pmPath, 'utf8'), outcome: data.outcome });
      } catch (_) {}
      continue;
    }
    const good = data.outcome === 'win' || data.outcome === 'target_hit';
    const lines = [
      `# Post-mortem — ${tradeId}`,
      '',
      `**Résultat** : ${data.outcome}`,
      `**Verdict** : ${good ? 'Idée bonne' : 'Idée mauvaise ou invalidation.'}`,
      '',
      data.note ? `**Note** : ${data.note}` : '',
      data.exit_price != null ? `**Prix de sortie** : ${data.exit_price}` : '',
      data.closed_at ? `**Clôturé le** : ${data.closed_at}` : '',
      '',
      '---',
      '*Généré par chase-tracker.js. Feedback diffusé aux agents (TECHNICALS, SMART_MONEY, SENTIMENT_X, ORCHESTRATOR, RISK_JOURNAL).*',
    ].filter(Boolean);
    fs.writeFileSync(pmPath, lines.join('\n'), 'utf8');
    postMortems.push({ trade_id: tradeId, content: lines.join('\n'), outcome: data.outcome });
  }

  const feedbackByAgent = {
    TECHNICALS: 'Retours Chase (post-mortem) : ' + postMortems.map((p) => `${p.trade_id} → ${p.outcome}`).join(' ; ') || 'Aucun post-mortem pour l’instant. Continuer à fournir trend et levels de qualité.',
    SMART_MONEY: 'Retours Chase : ' + postMortems.map((p) => `${p.trade_id} → ${p.outcome}`).join(' ; ') || 'Aucun post-mortem. Affiner funding et signaux smart money.',
    SENTIMENT_X: 'Retours Chase : ' + postMortems.map((p) => `${p.trade_id} → ${p.outcome}`).join(' ; ') || 'Aucun post-mortem. Affiner narratives et sentiment.',
    ORCHESTRATOR: 'Retours Chase : ' + postMortems.map((p) => `${p.trade_id} → ${p.outcome}`).join(' ; ') || 'Aucun post-mortem. Consolider signaux et idées selon feedback.',
    RISK_JOURNAL: 'Retours Chase : ' + postMortems.map((p) => `${p.trade_id} → ${p.outcome}`).join(' ; ') || 'Aucun post-mortem. Maintenir règles et validation.',
  };
  const feedbackJson = {
    timestamp_utc: new Date().toISOString(),
    post_mortem_count: postMortems.length,
    by_agent: feedbackByAgent,
  };
  fs.writeFileSync(path.join(ROOT, 'data', 'dashboard', 'chase_feedback.json'), JSON.stringify(feedbackJson, null, 2), 'utf8');
  for (const [agent, text] of Object.entries(feedbackByAgent)) {
    const fdPath = path.join(FEEDBACK_DIR, `${agent}.md`);
    fs.writeFileSync(fdPath, `# Feedback Chase pour ${agent}\n\n${text}\n`, 'utf8');
  }
  console.log('Chase: post-mortems', postMortems.length, '| feedback écrit dans data/tracker/feedback/ et data/dashboard/chase_feedback.json');
}

main();
