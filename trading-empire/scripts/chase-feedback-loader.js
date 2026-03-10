#!/usr/bin/env node
/**
 * TradeEmpire — Charge le feedback Chase (post-mortems) pour adapter les agents.
 * Utilisé par orchestrator-scan, risk-journal-scan, run-morning : en cas de loss,
 * les agents renforcent les critères ou activent plus d’APIs (RapidAPI).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHASE_FEEDBACK_PATH = path.join(ROOT, 'data', 'dashboard', 'chase_feedback.json');
const OUTCOMES_DIR = path.join(ROOT, 'data', 'tracker', 'outcomes');
const FEEDBACK_DIR = path.join(ROOT, 'data', 'tracker', 'feedback');

/** Extrait le symbole d’un trade_id (ex. idea_ATOMUSDT_20260302135745 → ATOMUSDT). */
function symbolFromTradeId(tradeId) {
  if (!tradeId || typeof tradeId !== 'string') return null;
  const m = tradeId.match(/^idea_([A-Z0-9]+)_\d+$/i);
  return m ? m[1].toUpperCase() : null;
}

/** Charge chase_feedback.json. */
function loadChaseFeedbackJson() {
  if (!fs.existsSync(CHASE_FEEDBACK_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHASE_FEEDBACK_PATH, 'utf8'));
  } catch (_) {
    return null;
  }
}

/** Jours pour considérer une perte comme "récente" (durcissement Chase). Au-delà, les règles normales s'appliquent. */
const RECENT_LOSS_DAYS = parseInt(process.env.TRADEEMPIRE_RECENT_LOSS_DAYS, 10) || 14;

/** Charge les outcomes complétés (non pending) depuis data/tracker/outcomes/. */
function loadCompletedOutcomes() {
  if (!fs.existsSync(OUTCOMES_DIR)) return [];
  const files = fs.readdirSync(OUTCOMES_DIR).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(OUTCOMES_DIR, f), 'utf8'));
      const outcome = (data.outcome || '').toLowerCase();
      if (outcome && outcome !== 'pending') {
        out.push({
          trade_id: data.trade_id || f.replace('.json', ''),
          outcome,
          symbol: data.symbol || symbolFromTradeId(data.trade_id || f),
          closed_at: data.closed_at || null,
        });
      }
    } catch (_) {}
  }
  return out;
}

/** Retourne les outcomes dont la clôture est dans la fenêtre "récente" (RECENT_LOSS_DAYS). Sans closed_at, considéré récent. */
function isOutcomeRecent(closedAt) {
  if (!closedAt) return true;
  const closed = new Date(closedAt).getTime();
  const cutoff = Date.now() - RECENT_LOSS_DAYS * 24 * 60 * 60 * 1000;
  return closed >= cutoff;
}

/**
 * Retourne les symboles ayant eu un loss ou invalid_hit récent (pour renforcer critères).
 */
function getRecentLossSymbols() {
  const outcomes = loadCompletedOutcomes();
  const symbols = new Set();
  for (const o of outcomes) {
    if (o.outcome === 'loss' || o.outcome === 'invalid_hit') {
      const sym = o.symbol || symbolFromTradeId(o.trade_id);
      if (sym) symbols.add(sym.toUpperCase());
    }
  }
  return Array.from(symbols);
}

/**
 * Retourne les symboles ayant eu target_hit ou win récent (pour confiance).
 */
function getRecentTargetOrWinSymbols() {
  const outcomes = loadCompletedOutcomes();
  const symbols = new Set();
  for (const o of outcomes) {
    if (o.outcome === 'target_hit' || o.outcome === 'win') {
      const sym = o.symbol || symbolFromTradeId(o.trade_id);
      if (sym) symbols.add(sym.toUpperCase());
    }
  }
  return Array.from(symbols);
}

/** Indique si le feedback Chase signale au moins un loss récent (fenêtre RECENT_LOSS_DAYS) pour activer le renforcement. */
function hasRecentLosses() {
  const outcomes = loadCompletedOutcomes();
  return outcomes.some((o) => (o.outcome === 'loss' || o.outcome === 'invalid_hit') && isOutcomeRecent(o.closed_at));
}

/** Nombre de post-mortems loss/invalid_hit récents (dans la fenêtre RECENT_LOSS_DAYS). */
function getLossCount() {
  const outcomes = loadCompletedOutcomes();
  return outcomes.filter((o) => (o.outcome === 'loss' || o.outcome === 'invalid_hit') && isOutcomeRecent(o.closed_at)).length;
}

/** Texte du feedback Chase pour un agent (ex. ORCHESTRATOR, TECHNICALS). */
function getFeedbackTextForAgent(agentId) {
  const json = loadChaseFeedbackJson();
  if (json && json.by_agent && json.by_agent[agentId]) return json.by_agent[agentId];
  const mdPath = path.join(FEEDBACK_DIR, `${agentId}.md`);
  if (!fs.existsSync(mdPath)) return '';
  try {
    const raw = fs.readFileSync(mdPath, 'utf8');
    return raw.replace(/^#.*\n\n?/, '').trim();
  } catch (_) {
    return '';
  }
}

module.exports = {
  loadChaseFeedbackJson,
  loadCompletedOutcomes,
  getRecentLossSymbols,
  getRecentTargetOrWinSymbols,
  hasRecentLosses,
  getLossCount,
  getFeedbackTextForAgent,
  symbolFromTradeId,
};
