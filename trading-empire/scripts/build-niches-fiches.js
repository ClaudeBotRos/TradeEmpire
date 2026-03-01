#!/usr/bin/env node
/**
 * TradeEmpire — Fiches Niches scorées à partir des idées (TRADE_IDEA).
 * Lit data/ideas/, dérive une fiche par idée (score macro, trend, structure, volume, funding, sentiment, R:R, etc.)
 * et écrit data/dashboard/niches/{trade_id}.json.
 * Usage: node scripts/build-niches-fiches.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const NICHES_DIR = path.join(ROOT, 'data', 'dashboard', 'niches');

function loadIdeas() {
  if (!fs.existsSync(IDEAS_DIR)) return [];
  const files = fs.readdirSync(IDEAS_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(IDEAS_DIR, f), 'utf8'));
    } catch (_) {
      return null;
    }
  }).filter(Boolean);
}

function scoreFiche(idea) {
  const conf = idea.confidence != null ? idea.confidence : 0.5;
  const rr = idea.targets && idea.targets[0] ? (idea.targets[0].rr || 1) : 1;
  const evidence = idea.evidence || {};
  const tech = (evidence.technicals || []).length;
  const sentiment = (evidence.sentiment || []).length;
  const sm = (evidence.smart_money || []).length;
  const trendScore = idea.direction && idea.direction !== 'range' ? 1 : 0;
  const score = Math.min(100, Math.round(
    conf * 40 + Math.min(rr / 2, 1) * 20 + (tech ? 15 : 0) + (sentiment ? 10 : 0) + (sm ? 10 : 0) + trendScore * 5
  ));
  return {
    trade_id: idea.trade_id,
    symbol: idea.symbol,
    direction: idea.direction,
    score_global: score,
    scores: {
      macro_trend: trendScore ? 1 : 0,
      structure_htf: tech ? 1 : 0,
      volume: 0,
      funding: sm ? 1 : 0,
      sentiment: sentiment ? 1 : 0,
      rr: Math.min(1, (rr || 0) / 2),
      invalidation: idea.invalid && idea.invalid.price ? 1 : 0,
      confidence: conf,
    },
    entry: idea.entry?.price,
    invalid: idea.invalid?.price,
    targets: idea.targets,
    timestamp_utc: idea.timestamp_utc,
  };
}

function main() {
  if (!fs.existsSync(NICHES_DIR)) fs.mkdirSync(NICHES_DIR, { recursive: true });
  const ideas = loadIdeas();
  let count = 0;
  for (const idea of ideas) {
    const tradeId = idea.trade_id || idea.symbol + '_' + Date.now();
    const fiche = scoreFiche(idea);
    const outPath = path.join(NICHES_DIR, `${tradeId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(fiche, null, 2), 'utf8');
    count++;
  }
  console.log('OK', count, 'fiches Niches écrites dans', NICHES_DIR);
}

main();
