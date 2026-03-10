#!/usr/bin/env node
/**
 * TradeEmpire — Contexte BOSS tâche visionnaire / expansion (en journée, avant 10h).
 * Agrège solde, PnL, et un contexte léger (roadmap, api_requests, costs) pour que le BOSS
 * réfléchisse aux opportunités de faire fructifier le capital. Écrit data/dashboard/boss_vision_context.json.
 * Usage: node scripts/boss-vision.js
 * Depuis workspace : node TradeEmpire/trading-empire/scripts/boss-vision.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DASH = path.join(ROOT, 'data', 'dashboard');

function readJson(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return null;
  }
}

async function main() {
  const timestampUtc = new Date().toISOString();

  if (!fs.existsSync(DATA_DASH)) {
    fs.mkdirSync(DATA_DASH, { recursive: true });
  }

  const roadmap = readJson(path.join(DATA_DASH, 'roadmap.json'));
  const apiRequests = readJson(path.join(DATA_DASH, 'api_requests.json'));
  const costs = readJson(path.join(DATA_DASH, 'costs.json'));
  const chaseFeedback = readJson(path.join(DATA_DASH, 'chase_feedback.json'));
  const recoveryReport = readJson(path.join(DATA_DASH, 'recovery_report.json'));
  const scoutProposals = readJson(path.join(DATA_DASH, 'scout_proposals.json'));
  const tiboReport = readJson(path.join(DATA_DASH, 'tibo_report.json'));
  const agentProfitSuggestions = readJson(path.join(DATA_DASH, 'agent_profit_suggestions.json'));

  let wallet_snapshot = null;
  let pnl_aster = null;
  try {
    const aster = require('./aster-client.js');
    if (aster && typeof aster.getAccount === 'function') {
      const account = await aster.getAccount();
      wallet_snapshot = {
        total_wallet_balance_usdt: parseFloat(account.totalWalletBalance || 0),
        available_balance_usdt: parseFloat(account.availableBalance || 0),
        total_unrealized_profit_usdt: parseFloat(account.totalUnrealizedProfit || 0),
        positions_count: (account.positions || []).filter((p) => parseFloat(p.positionAmt || 0) !== 0).length,
        source: 'ASTER',
        fetched_at: new Date().toISOString(),
      };
      if (aster.getRealizedPnlSummary) {
        pnl_aster = await aster.getRealizedPnlSummary({ days: 90 });
      }
    }
  } catch (_) {
    if (tiboReport && tiboReport.balance_snapshot) {
      wallet_snapshot = { ...tiboReport.balance_snapshot, source: 'tibo_report' };
    }
  }
  if (!wallet_snapshot && tiboReport && tiboReport.balance_snapshot) {
    wallet_snapshot = { ...tiboReport.balance_snapshot, source: 'tibo_report' };
  }

  const context = {
    timestamp_utc: timestampUtc,
    task: 'vision_expansion',
    summary: {
      roadmap_current: roadmap?.current_step_id || null,
      api_requests_count: Array.isArray(apiRequests) ? apiRequests.length : 0,
      has_costs: !!costs,
      chase_post_mortem_count: chaseFeedback?.post_mortem_count ?? 0,
      has_wallet_snapshot: !!wallet_snapshot,
      pnl_source: pnl_aster ? 'ASTER' : (recoveryReport ? 'recovery_report (outcomes locaux)' : null),
      pnl_summary: pnl_aster ? pnl_aster.summary : (recoveryReport ? recoveryReport.summary : null),
      realized_pnl_usdt: pnl_aster ? pnl_aster.realized_pnl_usdt : null,
      trades_closed_win_loss: pnl_aster
        ? { trades_count: pnl_aster.trades_count, win_count: pnl_aster.win_count, loss_count: pnl_aster.loss_count }
        : recoveryReport ? { by_outcome: recoveryReport.by_outcome } : null,
    },
    wallet_snapshot: wallet_snapshot,
    pnl_aster: pnl_aster,
    roadmap_summary: roadmap ? { current_step_id: roadmap.current_step_id, steps_done: (roadmap.steps || []).filter((s) => s.done).length } : null,
    api_requests: Array.isArray(apiRequests) ? apiRequests.slice(-20) : [],
    costs_summary: costs ? { api_costs: costs.api_costs, updated_at: costs.updated_at } : null,
    chase_feedback_summary: chaseFeedback ? { post_mortem_count: chaseFeedback.post_mortem_count, by_agent: chaseFeedback.by_agent } : null,
    recovery_report_summary: recoveryReport ? { summary: recoveryReport.summary, by_outcome: recoveryReport.by_outcome, _note: 'Données locales (outcomes). Pour PnL réel utiliser pnl_aster.' } : null,
    scout_proposals_summary: scoutProposals ? { proposals_count: scoutProposals.proposals?.length ?? 0, summary: scoutProposals.summary } : null,
    agent_profit_suggestions: Array.isArray(agentProfitSuggestions) ? agentProfitSuggestions.slice(-30) : [],
    instructions: [
      'Tu es le BOSS en mode **visionnaire / expansion**. TradeEmpire est à but lucratif : l’objectif est de faire des bénéfices. Cette tâche a lieu en journée (avant 10h) pour réfléchir à la croissance du capital. Prends en compte **agent_profit_suggestions** (pistes suggérées par les autres agents) pour tes propositions.',
      'Tu as accès au **solde et au PnL** (wallet_snapshot). **PnL trades clôturés :** utilise UNIQUEMENT **pnl_aster** (historique ASTER / position history) si présent ; sinon recovery_report_summary. Ne pas te baser sur les outcomes locaux seuls si pnl_aster est disponible.',
      'Tu ne te contentes pas du trading (TradeEmpire) : tu as le droit de t\'étendre à d\'autres activités que tu peux créer. Tu es en capacité de **créer des agents** pour les nouvelles tâches (propositions → validation humaine).',
      'Écris tes propositions dans **data/dashboard/boss_expansion_proposals.md** (format libre : idées, pistes, nouvelles activités, nouveaux agents). Pour proposer une règle, tâche, spec ou **nouvel agent** à valider : **data/dashboard/boss_proposals.json** avec proposals[].type = "rule"|"task"|"spec"|"agent". Pour un agent : inclure "suggested_id", "title", "description" (rôle, tâches, outils). Une fois validé, tu peux rédiger agents/<id>/tasks.md, tools.md, soul.md.',
      'Réponds par un **résumé court** (2–4 lignes) : ce que tu as écrit, les pistes principales, ou « Aucune piste nouvelle aujourd\'hui » si rien de concret. Ce résumé peut être envoyé sur WhatsApp.',
    ],
  };

  const outPath = path.join(DATA_DASH, 'boss_vision_context.json');
  fs.writeFileSync(outPath, JSON.stringify(context, null, 2), 'utf8');
  console.log('BOSS vision context written to', outPath);
  console.log(JSON.stringify({ ok: true, file: outPath, summary: context.summary }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
