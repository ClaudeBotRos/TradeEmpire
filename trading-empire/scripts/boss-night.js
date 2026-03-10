#!/usr/bin/env node
/**
 * TradeEmpire — Contexte BOSS tâche nocturne.
 * Agrège l’état du dashboard (roadmap, api_requests, agent_exchanges, kanban, costs)
 * et écrit data/dashboard/boss_night_context.json pour que le BOSS puisse lire et mettre à jour spec/config.
 * Usage: node scripts/boss-night.js
 * Depuis workspace : node TradeEmpire/trading-empire/scripts/boss-night.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DASH = path.join(ROOT, 'data', 'dashboard');
const SPEC_DIR = path.join(ROOT, 'dashboard', 'spec');
const CONFIG_DIR = path.join(ROOT, 'dashboard', 'config');

function readJson(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function dataAgeHours(isoStr) {
  if (!isoStr) return null;
  const t = new Date(isoStr).getTime();
  if (isNaN(t)) return null;
  return (Date.now() - t) / (60 * 60 * 1000);
}

async function fetchLiveBalance() {
  try {
    const aster = require('./aster-client.js');
    if (aster && typeof aster.getAccount === 'function') {
      const account = await aster.getAccount();
      return {
        total_wallet_balance_usdt: parseFloat(account.totalWalletBalance || 0),
        available_balance_usdt: parseFloat(account.availableBalance || 0),
        total_unrealized_profit_usdt: parseFloat(account.totalUnrealizedProfit || 0),
        positions_count: (account.positions || []).filter((p) => parseFloat(p.positionAmt || 0) !== 0).length,
        source: 'ASTER',
        fetched_at: new Date().toISOString(),
      };
    }
  } catch (_) {}
  return null;
}

async function main() {
  const now = new Date();
  const timestampUtc = now.toISOString();

  if (!fs.existsSync(DATA_DASH)) {
    fs.mkdirSync(DATA_DASH, { recursive: true });
  }
  if (!fs.existsSync(SPEC_DIR)) {
    fs.mkdirSync(SPEC_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const roadmap = readJson(path.join(DATA_DASH, 'roadmap.json'));
  const apiRequests = readJson(path.join(DATA_DASH, 'api_requests.json'));
  const agentExchanges = readJson(path.join(DATA_DASH, 'agent_exchanges.json'));
  const kanban = readJson(path.join(DATA_DASH, 'kanban.json'));
  const costs = readJson(path.join(DATA_DASH, 'costs.json'));
  const trendCards = readJson(path.join(DATA_DASH, 'intel', 'trend_cards.json'));
  const chaseFeedback = readJson(path.join(DATA_DASH, 'chase_feedback.json'));
  const recoveryReport = readJson(path.join(DATA_DASH, 'recovery_report.json'));
  const tiboReport = readJson(path.join(DATA_DASH, 'tibo_report.json'));
  const agentProfitSuggestions = readJson(path.join(DATA_DASH, 'agent_profit_suggestions.json'));

  let wallet_snapshot = await fetchLiveBalance();
  if (!wallet_snapshot && tiboReport?.balance_snapshot) {
    wallet_snapshot = { ...tiboReport.balance_snapshot, source: 'tibo_report (ancien)', fetched_at: tiboReport.balance_snapshot?.updated_at || tiboReport.updated_at };
  }

  let pnl_aster = null;
  try {
    const aster = require('./aster-client.js');
    if (aster && aster.getRealizedPnlSummary) {
      pnl_aster = await aster.getRealizedPnlSummary({ days: 90 });
    }
  } catch (_) {}

  const data_ages = {
    chase_feedback_utc: chaseFeedback?.timestamp_utc || null,
    chase_feedback_hours_ago: dataAgeHours(chaseFeedback?.timestamp_utc),
    recovery_report_utc: recoveryReport?.timestamp_utc || null,
    recovery_report_hours_ago: dataAgeHours(recoveryReport?.timestamp_utc),
    costs_updated_at: costs?.updated_at || null,
    costs_hours_ago: dataAgeHours(costs?.updated_at),
    tibo_report_updated_at: tiboReport?.updated_at || null,
  };

  const exchanges = Array.isArray(agentExchanges) ? agentExchanges : [];
  const lastExchanges = exchanges.slice(-50);

  const stepsDone = (roadmap?.steps || []).filter((s) => s.done).length;
  const costsForBoss = costs ? {
    ...costs,
    api_costs: (costs.api_costs || []).filter((c) => (c.id || '').toLowerCase() !== 'clawrouter'),
    _note: 'ClawRouter exclu : on utilise UNIQUEMENT OpenRouter.',
  } : null;

  const context = {
    timestamp_utc: timestampUtc,
    summary: {
      roadmap_current: roadmap?.current_step_id || null,
      roadmap_steps_done: stepsDone,
      roadmap_8_8: stepsDone >= 8,
      trading_reel: true,
      api_requests_count: Array.isArray(apiRequests) ? apiRequests.length : 0,
      agent_exchanges_count: exchanges.length,
      has_kanban: !!kanban,
      has_costs: !!costsForBoss,
      intel_trend_cards_count: trendCards?.cards?.length ?? 0,
      chase_post_mortem_count: chaseFeedback?.post_mortem_count ?? 0,
      wallet_source: wallet_snapshot?.source || null,
      wallet_balance_usdt: wallet_snapshot?.available_balance_usdt ?? wallet_snapshot?.total_wallet_balance_usdt ?? null,
      pnl_source: pnl_aster ? 'ASTER' : (recoveryReport ? 'recovery_report (outcomes locaux)' : null),
      pnl_summary: pnl_aster ? pnl_aster.summary : (recoveryReport ? recoveryReport.summary : null),
      realized_pnl_usdt: pnl_aster ? pnl_aster.realized_pnl_usdt : null,
      trades_closed_win_loss: pnl_aster
        ? { trades_count: pnl_aster.trades_count, win_count: pnl_aster.win_count, loss_count: pnl_aster.loss_count }
        : recoveryReport ? { by_outcome: recoveryReport.by_outcome } : null,
    },
    wallet_snapshot: wallet_snapshot,
    pnl_aster: pnl_aster,
    data_ages,
    notes_contexte: [
      "**ClawRouter : ON S'EN FOUT. On utilise UNIQUEMENT OpenRouter.** Ne jamais mentionner, évaluer ou prioriser ClawRouter. Il n'est pas dans les coûts passés au BOSS.",
      "**Roadmap : 8/8 — trading RÉEL en place.** Ne pas dire qu'on attend la décision V2 ou que la V2 n'est pas activée.",
      "**YouTube / Intel (Daphnée) :** filtrage en place. Ne pas radoter sur les cards borderline ou la qualité YouTube.",
      "**PnL / trades clôturés :** utilise UNIQUEMENT **pnl_aster** (historique ASTER / position history) si présent pour les chiffres win/loss et PnL réalisé ; sinon recovery_report. Ne pas citer les outcomes locaux (recovery_report) comme source de vérité si pnl_aster est disponible.",
      "**Chase / recovery :** si les chiffres win/loss sont anciens ou ne reflètent pas la réalité, ne pas les citer comme récents. Indiquer que les données sont à actualiser ou les ignorer. Ne pas présenter des pertes anciennes comme si c'était la semaine en cours.",
    ],
    roadmap,
    api_requests: apiRequests,
    agent_exchanges: lastExchanges,
    kanban,
    costs: costsForBoss,
    intel_trend_cards: trendCards ? { date: trendCards.date, cards_count: trendCards.cards?.length ?? 0, cards: (trendCards.cards || []).slice(0, 10) } : null,
    chase_feedback: chaseFeedback ? { timestamp_utc: chaseFeedback.timestamp_utc, post_mortem_count: chaseFeedback.post_mortem_count, by_agent: chaseFeedback.by_agent } : null,
    recovery_report: recoveryReport ? { timestamp_utc: recoveryReport.timestamp_utc, summary: recoveryReport.summary, by_outcome: recoveryReport.by_outcome, by_symbol: recoveryReport.by_symbol, _note: 'Outcomes locaux. Pour PnL réel utiliser pnl_aster.' } : null,
    tibo_report: tiboReport ? { balance_snapshot: tiboReport.balance_snapshot, pending_tp_count: tiboReport.pending_tp_count, orders_today: tiboReport.orders_today, updated_at: tiboReport.updated_at } : null,
    agent_profit_suggestions: Array.isArray(agentProfitSuggestions) ? agentProfitSuggestions.slice(-30) : [],
    instructions: [
      '**ÉTAPE 1 — EN PREMIER** : Rédige ton **brief de nuit complet** : état du système (solde wallet_snapshot, **roadmap 8/8 = trading réel**), ce que tu as fait, priorités. Min. 400 car. **Respecte notes_contexte** : pas de ClawRouter, pas de radotage YouTube borderline, pas de pertes Chase présentées comme récentes si données anciennes. Puis écris le brief en entier dans data/dashboard/last_boss_brief.md. Outil write. Fais ça en premier.',
      'Évolutions et priorisation API : voir instruction suivante. Propositions d’amélioration dashboard.',
      'Mettre à jour evolutions.md et api_needs_priority.md. **Uniquement OpenRouter et X** — jamais mentionner ClawRouter.',
      'Si tu proposes de nouvelles règles, tâches, specs ou **nouveaux agents** (créations nocturnes), écris-les dans data/dashboard/boss_proposals.json : { "timestamp_utc": "<ISO>", "proposals": [ { "title": "...", "description": "...", "type": "rule"|"task"|"spec"|"agent", "suggested_id": "..." (si type agent) } ] }. Validation humaine requise. Tu peux t\'étendre au-delà du trading et créer des agents pour de nouvelles activités.',
      'Kanban : les tâches en colonne "À faire" (columnId todo), notamment celles avec source "boss_proposal", ont été validées par l’humain. Implémente-les (modifications code, spec, config selon title + description). Après chaque tâche réalisée, ajoute son id dans data/dashboard/kanban_completed.json : { "completed_ids": ["task-xxx", ...] }. Un script déplacera ces tâches en "Fait" après ta réponse.',
      '**Réponse finale** : Ta réponse = exactement le même texte que le brief dans last_boss_brief.md. Rien d\'autre. Ce texte part sur WhatsApp. Pas de ClawRouter, pas de YouTube borderline, pas de pertes anciennes présentées comme récentes ; roadmap 8/8 = trading réel.',
    ],
  };

  const outPath = path.join(DATA_DASH, 'boss_night_context.json');
  fs.writeFileSync(outPath, JSON.stringify(context, null, 2), 'utf8');
  console.log('BOSS night context written to', outPath);
  console.log(JSON.stringify({ ok: true, file: outPath, summary: context.summary, wallet_source: wallet_snapshot?.source }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
