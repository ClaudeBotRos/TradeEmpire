#!/usr/bin/env node
/**
 * TradeEmpire — Recovery Analyst : revue intraday des ordres réellement en place sur ASTER.
 * Récupère les ordres ouverts via l’API ASTER, ne traite pas les idées/décisions.
 * Pour chaque ordre d’entrée (LIMIT en attente), compare au trend actuel → keep ou cancel.
 * Avec --apply-cancel : annule sur ASTER les ordres recommandés cancel (appel cancelOrder).
 * Usage: node scripts/recovery-intraday-review.js [--md] [--apply-cancel]
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TECHNICALS_DIR = path.join(ROOT, 'data', 'signals', 'technicals');
const SCOUT_PROPOSALS_PATH = path.join(ROOT, 'data', 'dashboard', 'scout_proposals.json');
const WATCHLIST_PATH = path.join(ROOT, 'data', 'dashboard', 'watchlist.json');
const REPORT_JSON_PATH = path.join(ROOT, 'data', 'dashboard', 'recovery_intraday_report.json');
const AGENT_RECO_PATH = path.join(ROOT, 'data', 'dashboard', 'recovery_agent_recommendations.json');
const AGENT_RECO_MAX_AGE_MS = 15 * 60 * 1000;
const REPORTS_DIR = path.join(ROOT, 'data', 'reports');

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
    return Array.isArray(data.symbols) ? data.symbols : [];
  } catch (_) {
    return [];
  }
}

function loadLatestTechnicalsBySymbol() {
  if (!fs.existsSync(TECHNICALS_DIR)) return {};
  const files = fs.readdirSync(TECHNICALS_DIR).filter((f) => f.endsWith('.json'));
  const byKey = {};
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(TECHNICALS_DIR, f), 'utf8'));
      const key = `${(data.symbol || '').toUpperCase()}_${data.timeframe || '4h'}`;
      const ts = (data.timestamp_utc || '').replace(/[-:T.Z]/g, '');
      if (!byKey[key] || (ts && (!byKey[key].timestamp_utc || ts > (byKey[key].timestamp_utc || '').replace(/[-:T.Z]/g, '')))) {
        byKey[key] = data;
      }
    } catch (_) {}
  }
  return byKey;
}

function loadScoutProposals() {
  if (!fs.existsSync(SCOUT_PROPOSALS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(SCOUT_PROPOSALS_PATH, 'utf8'));
  } catch (_) {
    return null;
  }
}

/** Ordres d’entrée uniquement : LIMIT sans stopPrice (en attente de fill). On ignore SL/TP. */
function isEntryOrder(order) {
  const type = (order.type || '').toUpperCase();
  const stopPrice = String(order.stopPrice ?? '').trim();
  const noStop = !stopPrice || stopPrice === '0' || stopPrice === '0.0';
  return type === 'LIMIT' && noStop;
}

/** Recommandation keep | cancel selon side (BUY=long, SELL=short) vs trend. */
function recommendOrder(side, symbol, technicalsByKey) {
  const key = `${(symbol || '').toUpperCase()}_4h`;
  const tech = technicalsByKey[key];
  const trend = tech && (tech.trend || '').toLowerCase();
  const isLong = (side || '').toUpperCase() === 'BUY';

  if (!trend || trend === 'range') return { action: 'keep', reason: 'Trend range ou inconnu.' };
  if (isLong && trend === 'down') return { action: 'cancel', reason: 'Marché en baisse ; ordre LONG non pertinent.' };
  if (isLong && trend === 'up') return { action: 'keep', reason: 'Trend haussier aligné.' };
  if (!isLong && trend === 'up') return { action: 'cancel', reason: 'Marché en hausse ; ordre SHORT non pertinent.' };
  if (!isLong && trend === 'down') return { action: 'keep', reason: 'Trend baissier aligné.' };
  return { action: 'keep', reason: 'Pas de conflit.' };
}

async function main() {
  let aster;
  try {
    aster = require('./aster-client.js');
  } catch (e) {
    console.error('ASTER indisponible:', e.message);
    process.exit(1);
  }

  let allOpen = [];
  try {
    allOpen = await aster.getOpenOrders();
  } catch (e) {
    if (e.message && e.message.includes('symbol')) {
      const watchlist = loadWatchlist();
      if (watchlist.length === 0) watchlist.push('BTCUSDT', 'ETHUSDT');
      for (const sym of watchlist) {
        try {
          const list = await aster.getOpenOrders(sym);
          allOpen = allOpen.concat(list);
        } catch (_) {}
      }
    } else {
      console.error('Erreur ASTER getOpenOrders:', e.message);
      process.exit(1);
    }
  }

  if (allOpen.length === 0) {
    const watchlist = loadWatchlist();
    if (watchlist.length > 0) {
      for (const sym of watchlist) {
        try {
          const list = await aster.getOpenOrders(sym);
          allOpen = allOpen.concat(list);
        } catch (_) {}
      }
    }
  }

  const entryOrders = allOpen.filter(isEntryOrder);
  if (process.env.RECOVERY_DEBUG) {
    console.error('ASTER openOrders total:', allOpen.length, '| entry (LIMIT sans stop):', entryOrders.length);
  }
  const technicalsByKey = loadLatestTechnicalsBySymbol();
  const scout = loadScoutProposals();

  let reviews = [];
  let usedAgentReco = false;
  const agentRecoPath = AGENT_RECO_PATH;
  if (
    fs.existsSync(agentRecoPath) &&
    Date.now() - fs.statSync(agentRecoPath).mtimeMs < AGENT_RECO_MAX_AGE_MS
  ) {
    try {
      const agentData = JSON.parse(fs.readFileSync(agentRecoPath, 'utf8'));
      const recos = Array.isArray(agentData.recommendations) ? agentData.recommendations : [];
      const byOrderId = new Map(recos.map((r) => [String(r.orderId), r]));
      for (const order of entryOrders) {
        const rec = byOrderId.get(String(order.orderId));
        const action = rec && (rec.action === 'cancel' || rec.action === 'keep') ? rec.action : 'keep';
        const reason = rec && rec.reason ? rec.reason : 'Reco agent sans raison.';
        reviews.push({
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          price: order.price,
          origQty: order.origQty,
          type: order.type,
          action,
          reason,
        });
      }
      if (reviews.length === entryOrders.length) usedAgentReco = true;
      if (process.env.RECOVERY_DEBUG) console.error('Recovery: using agent recommendations.');
    } catch (e) {
      if (process.env.RECOVERY_DEBUG) console.error('Recovery: agent recos parse failed', e.message);
    }
  }
  if (!usedAgentReco || reviews.length !== entryOrders.length) {
    reviews = [];
    for (const order of entryOrders) {
      const symbol = (order.symbol || '').toUpperCase();
      const side = (order.side || '').toUpperCase();
      const { action, reason } = recommendOrder(side, symbol, technicalsByKey);
      reviews.push({
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side,
        price: order.price,
        origQty: order.origQty,
        type: order.type,
        action,
        reason,
      });
    }
  }

  const cancelCount = reviews.filter((r) => r.action === 'cancel').length;
  const applyCancel = process.argv.includes('--apply-cancel');
  if (applyCancel && cancelCount > 0 && aster.cancelOrder) {
    for (const r of reviews) {
      if (r.action !== 'cancel') continue;
      try {
        await aster.cancelOrder(r.symbol, r.orderId);
        console.log('Annulé sur ASTER:', r.symbol, r.orderId);
      } catch (e) {
        console.warn('Échec annulation', r.symbol, r.orderId, e.message);
      }
    }
  }

  const newCandidatesFromScout = [];
  if (scout && Array.isArray(scout.proposals) && scout.proposals.length > 0) {
    const orderSymbols = new Set(reviews.map((r) => (r.symbol || '').toUpperCase()));
    for (const p of scout.proposals) {
      const sym = (p.symbol || '').toUpperCase();
      if (!sym || orderSymbols.has(sym)) continue;
      if (p.source === 'niches' || p.source === 'watchlist_extension' || p.source === 'timeframe') {
        newCandidatesFromScout.push({ symbol: sym, reason: p.reason, source: p.source });
      }
    }
  }

  const report = {
    timestamp_utc: new Date().toISOString(),
    source: 'ASTER',
    pending_count: entryOrders.length,
    reviews,
    summary: `${entryOrders.length} ordre(s) ouverts sur ASTER (entrée). ${reviews.filter((r) => r.action === 'keep').length} à conserver, ${cancelCount} à annuler.`,
    new_candidates_from_scout: newCandidatesFromScout.slice(0, 10),
    scout_note: newCandidatesFromScout.length > 0 ? 'Candidats Scout pour diversification (risk + orchestrator).' : null,
  };

  const dashDir = path.dirname(REPORT_JSON_PATH);
  if (!fs.existsSync(dashDir)) fs.mkdirSync(dashDir, { recursive: true });
  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log('Recovery intraday report written to', REPORT_JSON_PATH);

  const wantMd = process.argv.includes('--md');
  if (wantMd) {
    const date = new Date().toISOString().slice(0, 10);
    const mdPath = path.join(REPORTS_DIR, `${date}_intraday_review.md`);
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    let md = `# Revue intraday (Recovery Analyst) — Ordres ASTER — ${date}\n\n`;
    md += `Généré le ${report.timestamp_utc}\n\n## Synthèse\n\n${report.summary}\n\n## Ordres ouverts (entrée)\n\n| Order ID | Symbole | Side | Prix | Action | Raison |\n|----------|---------|------|------|--------|--------|\n`;
    for (const r of report.reviews) {
      md += `| ${r.orderId} | ${r.symbol || '-'} | ${r.side || '-'} | ${r.price || '-'} | **${r.action}** | ${(r.reason || '').replace(/\|/g, ' ')} |\n`;
    }
    if (report.new_candidates_from_scout.length > 0) {
      md += `\n## Candidats Scout (diversification)\n\n`;
      for (const c of report.new_candidates_from_scout) {
        md += `- **${c.symbol}** : ${c.reason} (${c.source})\n`;
      }
      md += `\n${report.scout_note}\n`;
    }
    fs.writeFileSync(mdPath, md, 'utf8');
    console.log('Intraday review (MD) written to', mdPath);
  }

  console.log(JSON.stringify({
    ok: true,
    source: 'ASTER',
    pending_count: report.pending_count,
    keep: report.reviews.filter((r) => r.action === 'keep').length,
    cancel: cancelCount,
    new_candidates: report.new_candidates_from_scout.length,
    file: REPORT_JSON_PATH,
  }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
