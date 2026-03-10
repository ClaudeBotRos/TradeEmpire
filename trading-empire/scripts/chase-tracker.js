#!/usr/bin/env node
/**
 * TradeEmpire — Chase (Tracker) : suit les idées APPROVED, post-mortem, annulation d’ordres obsolètes, feedback aux agents.
 * 1) Vérifie les positions fermées via ASTER, met à jour les outcomes (win/loss/target_hit).
 * 2) Annule les ordres ouverts plus d’actualité : prix trop éloigné du mark, tendance plus bonne (loss récent), orphelins (plus de position). Libère la marge. (CHASE_STALE_ORDER_PCT, défaut 10 %)
 * 3) Sync idées APPROVED → data/tracker/outcomes/ (pending si absent).
 * 4) Génère post_mortem pour chaque outcome complété.
 * 5) Agrège feedback par agent dans data/tracker/feedback/. Chaque outcome déjà diffusé est enregistré dans chase_processed_outcomes.json pour ne pas répéter les mêmes ordres fermés à chaque run.
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
const EXECUTED_ORDERS_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');
const PROCESSED_OUTCOMES_PATH = path.join(ROOT, 'data', 'tracker', 'chase_processed_outcomes.json');

function loadProcessedOutcomeIds() {
  if (!fs.existsSync(PROCESSED_OUTCOMES_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(PROCESSED_OUTCOMES_PATH, 'utf8'));
    const ids = Array.isArray(data.processed_trade_ids) ? data.processed_trade_ids : [];
    return new Set(ids);
  } catch (_) {
    return new Set();
  }
}

function saveProcessedOutcomeIds(processedSet) {
  const dir = path.dirname(PROCESSED_OUTCOMES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROCESSED_OUTCOMES_PATH, JSON.stringify({
    processed_trade_ids: [...processedSet],
    last_updated: new Date().toISOString(),
  }, null, 2), 'utf8');
}

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

function loadOutcome(tradeId) {
  const p = path.join(OUTCOMES_DIR, `${tradeId}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function saveOutcome(tradeId, update) {
  const outPath = path.join(OUTCOMES_DIR, `${tradeId}.json`);
  let data = loadOutcome(tradeId);
  if (!data) return false;
  const alreadySet = data.outcome && data.outcome !== 'pending';
  const correctLossToWin = alreadySet && data.outcome === 'loss' && update.outcome === 'target_hit';
  const correctLossToRevoked = alreadySet && data.outcome === 'loss' && update.outcome === 'revoked';
  if (alreadySet && !correctLossToWin && !correctLossToRevoked) return false;
  data.outcome = update.outcome;
  if (update.exit_price != null) data.exit_price = update.exit_price;
  if (update.closed_at) data.closed_at = update.closed_at;
  if (update.note) data.note = update.note;
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

/** Vérifie les positions fermées via ASTER (positionRisk + userTrades), met à jour les outcomes. */
async function syncClosedFromExchange() {
  let getAccount, getUserTrades;
  try {
    const aster = require('./aster-client.js');
    getAccount = aster.getAccount;
    getUserTrades = aster.getUserTrades;
  } catch (_) {
    return;
  }
  if (!fs.existsSync(EXECUTED_ORDERS_PATH)) return;
  let executed;
  try {
    executed = JSON.parse(fs.readFileSync(EXECUTED_ORDERS_PATH, 'utf8'));
  } catch (_) {
    return;
  }
  if (!Array.isArray(executed) || executed.length === 0) return;

  let account;
  try {
    account = await getAccount();
  } catch (e) {
    return;
  }
  const positions = (account && account.positions) || [];
  const openSymbols = new Set();
  for (const p of positions) {
    const amt = parseFloat(p.positionAmt || '0');
    if (amt !== 0) openSymbols.add((p.symbol || '').toUpperCase());
  }

  const closedBySymbol = new Map();
  for (const o of executed) {
    const symbol = (o.symbol || '').toUpperCase();
    if (!symbol || openSymbols.has(symbol)) continue;
    if (!closedBySymbol.has(symbol)) closedBySymbol.set(symbol, []);
    closedBySymbol.get(symbol).push(o);
  }
  if (closedBySymbol.size === 0) return;

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  let synced = 0;
  for (const [symbol, orders] of closedBySymbol) {
    const orderIds = new Map();
    for (const o of orders) {
      if (o.sl_order_id != null) orderIds.set(Number(o.sl_order_id), { trade_id: o.trade_id, isSl: true });
      if (o.tp_order_id != null) orderIds.set(Number(o.tp_order_id), { trade_id: o.trade_id, isSl: false });
    }
    const startTime = Math.max(0, now - sevenDays);
    let trades;
    try {
      trades = await getUserTrades(symbol, { startTime, endTime: now, limit: 500 });
    } catch (_) {
      continue;
    }
    const byTradeId = new Map();
    const filledOrderIds = new Set(trades.map((t) => Number(t.orderId)));
    for (const t of trades) {
      const info = orderIds.get(Number(t.orderId));
      if (!info) continue;
      const exitPrice = parseFloat(t.price);
      const closedAt = t.time ? new Date(t.time).toISOString().slice(0, 10) : null;
      const existing = byTradeId.get(info.trade_id);
      if (!existing || (t.time && existing.time < t.time)) {
        byTradeId.set(info.trade_id, { ...info, price: t.price, time: t.time, exitPrice, closedAt });
      }
    }
    for (const [tradeId, info] of byTradeId) {
      const outcome = info.isSl ? 'loss' : 'target_hit';
      const ok = saveOutcome(tradeId, {
        outcome,
        exit_price: Number.isFinite(info.exitPrice) ? info.exitPrice : undefined,
        closed_at: info.closedAt,
        note: outcome === 'loss' ? 'SL détecté (Chase via ASTER)' : 'TP détecté (Chase via ASTER)',
      });
      if (ok) synced++;
    }
    const matchedIds = new Set(byTradeId.keys());
    const entryTimeByTradeId = new Map();
    for (const t of trades) {
      const o = orders.find((x) => Number(x.entry_order_id) === Number(t.orderId));
      if (o && t.time) entryTimeByTradeId.set(o.trade_id, t.time);
    }
    const REVOKED_PNL_THRESHOLD = 0.01;
    const orphanCloses = trades
      .filter((t) => {
        const rpnl = parseFloat(t.realizedPnl);
        return Number.isFinite(rpnl) && !orderIds.has(Number(t.orderId));
      })
      .map((t) => ({ time: t.time || 0, realizedPnl: parseFloat(t.realizedPnl), price: parseFloat(t.price) }))
      .sort((a, b) => a.time - b.time);
    const unmatchedWithEntry = orders
      .filter((o) => !matchedIds.has(o.trade_id) && entryTimeByTradeId.has(o.trade_id))
      .sort((a, b) => (entryTimeByTradeId.get(a.trade_id) || 0) - (entryTimeByTradeId.get(b.trade_id) || 0));
    const usedCloseIndex = new Set();
    const matchedNow = new Set();
    for (const o of unmatchedWithEntry) {
      const entryT = entryTimeByTradeId.get(o.trade_id) || 0;
      let bestIdx = -1;
      let bestTime = Infinity;
      for (let i = 0; i < orphanCloses.length; i++) {
        if (usedCloseIndex.has(i)) continue;
        if (orphanCloses[i].time < entryT) continue;
        if (orphanCloses[i].time < bestTime) {
          bestTime = orphanCloses[i].time;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) continue;
      usedCloseIndex.add(bestIdx);
      matchedNow.add(o.trade_id);
      const close = orphanCloses[bestIdx];
      let outcome;
      let note;
      if (close.realizedPnl > REVOKED_PNL_THRESHOLD) {
        outcome = 'target_hit';
        note = 'Clôture détectée via ASTER (realizedPnl > 0) — TP ou clôture manuelle gagnante.';
      } else if (close.realizedPnl < -REVOKED_PNL_THRESHOLD) {
        outcome = 'loss';
        note = 'Clôture détectée via ASTER (realizedPnl < 0) — SL ou clôture manuelle perdante.';
      } else {
        outcome = 'revoked';
        note = 'Invalidation ou clôture sans perte (realizedPnl ≈ 0) — pas une perte, bon pour les bénéfices.';
      }
      const closedAt = close.time ? new Date(close.time).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      const ok = saveOutcome(o.trade_id, {
        outcome,
        exit_price: Number.isFinite(close.price) ? close.price : undefined,
        closed_at: closedAt,
        note,
      });
      if (ok) synced++;
    }
    for (const o of orders) {
      if (matchedIds.has(o.trade_id) || matchedNow.has(o.trade_id)) continue;
      const entryOrderId = o.entry_order_id != null ? Number(o.entry_order_id) : null;
      const entryWasFilled = entryOrderId != null && filledOrderIds.has(entryOrderId);
      if (!entryWasFilled) {
        const ok = saveOutcome(o.trade_id, {
          outcome: 'revoked',
          closed_at: new Date().toISOString().slice(0, 10),
          note: 'Ordre annulé avant exécution (recovery ou manuel) — pas une perte, action saine.',
        });
        if (ok) synced++;
      } else {
        const ok = saveOutcome(o.trade_id, {
          outcome: 'loss',
          closed_at: new Date().toISOString().slice(0, 10),
          note: 'Position fermée (Chase via ASTER), ordre de clôture non identifié (manuel?).',
        });
        if (ok) synced++;
      }
    }
  }
  if (synced) console.log('Chase: sync ASTER →', synced, 'outcome(s) mis à jour (positions fermées).');
}

/** Seuil (en part de 1) au-delà duquel un ordre est considéré trop éloigné du prix (ex. 0.10 = 10 %). */
const STALE_ORDER_DISTANCE_PCT = Math.min(0.5, Math.max(0.05, parseFloat(process.env.CHASE_STALE_ORDER_PCT || '0.10', 10) / 100));

/**
 * Post-mortem : annule les ordres ouverts qui ne sont plus d’actualité (prix trop éloigné, tendance plus bonne, orphelins).
 * Libère de la marge pour de nouveaux trades.
 */
async function cancelStaleOrders() {
  let getAccount, getOpenOrders, getMarkPrice, cancelOrder;
  try {
    const aster = require('./aster-client.js');
    getAccount = aster.getAccount;
    getOpenOrders = aster.getOpenOrders;
    getMarkPrice = aster.getMarkPrice;
    cancelOrder = aster.cancelOrder;
  } catch (_) {
    return;
  }
  if (!fs.existsSync(EXECUTED_ORDERS_PATH)) return;
  let executed;
  try {
    executed = JSON.parse(fs.readFileSync(EXECUTED_ORDERS_PATH, 'utf8'));
  } catch (_) {
    return;
  }
  if (!Array.isArray(executed) || executed.length === 0) return;

  let account;
  try {
    account = await getAccount();
  } catch (_) {
    return;
  }
  const positions = (account && account.positions) || [];
  const openSymbols = new Set();
  for (const p of positions) {
    const amt = parseFloat(p.positionAmt || '0');
    if (amt !== 0) openSymbols.add((p.symbol || '').toUpperCase());
  }

  let lossSymbols = new Set();
  try {
    const chaseLoader = require('./chase-feedback-loader.js');
    if (chaseLoader.getRecentLossSymbols) lossSymbols = new Set((chaseLoader.getRecentLossSymbols() || []).map((s) => String(s).toUpperCase()));
  } catch (_) {}

  const symbols = [...new Set(executed.map((o) => (o.symbol || '').toUpperCase()).filter(Boolean))];
  let cancelled = 0;
  for (const symbol of symbols) {
    let orders;
    try {
      orders = await getOpenOrders(symbol);
    } catch (_) {
      continue;
    }
    if (!orders || orders.length === 0) continue;

    let mark = 0;
    try {
      mark = parseFloat(await getMarkPrice(symbol)) || 0;
    } catch (_) {}

    const hasPosition = openSymbols.has(symbol);
    const trendBad = lossSymbols.has(symbol);

    for (const o of orders) {
      const orderPrice = parseFloat(o.stopPrice || o.price || '0') || 0;
      const isTp = (o.type || '').toUpperCase().includes('TAKE_PROFIT');

      let shouldCancel = false;
      let reason = '';

      if (!hasPosition) {
        shouldCancel = true;
        reason = 'ordre orphelin (plus de position)';
      } else if (mark > 0 && orderPrice > 0) {
        const dist = Math.abs(orderPrice - mark) / mark;
        if (dist > STALE_ORDER_DISTANCE_PCT) {
          shouldCancel = true;
          reason = `prix trop éloigné (${(dist * 100).toFixed(1)} % du mark)`;
        }
      }
      if (!shouldCancel && trendBad && isTp) {
        shouldCancel = true;
        reason = 'tendance plus favorable (loss récent Chase)';
      }

      if (!shouldCancel) continue;
      try {
        await cancelOrder(symbol, o.orderId);
        cancelled++;
        console.log('Chase: ordre annulé', symbol, o.orderId, o.type, '—', reason);
      } catch (e) {
        if (process.env.DEBUG_CHASE) console.error('Chase: cancel', symbol, o.orderId, e?.message || e);
      }
    }
  }
  if (cancelled) console.log('Chase:', cancelled, 'ordre(s) obsolète(s) annulés (marge libérée).');
}

async function main() {
  [OUTCOMES_DIR, POST_MORTEM_DIR, FEEDBACK_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  await syncClosedFromExchange();
  await cancelStaleOrders();

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
      note: 'Remplir outcome (win|loss|invalid_hit|target_hit|revoked), optionnel: exit_price, closed_at, note. revoked = annulé avant exécution (pas une perte).',
    };
    fs.writeFileSync(outPath, JSON.stringify(outcome, null, 2), 'utf8');
    synced++;
  }
  if (synced) console.log('Chase: synced', synced, 'approved ideas to outcomes (pending).');

  const today = new Date().toISOString().slice(0, 10);
  const outcomeFiles = fs.existsSync(OUTCOMES_DIR) ? fs.readdirSync(OUTCOMES_DIR).filter((f) => f.endsWith('.json')) : [];
  const postMortems = [];
  const byDate = new Map(); // closed_at -> [ { trade_id, content, outcome } ]
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
    const closedAt = data.closed_at || today;
    const good = data.outcome === 'win' || data.outcome === 'target_hit' || data.outcome === 'revoked';
    const verdictRevoked = data.outcome === 'revoked' ? 'Ordre annulé ou invalidation sans perte — pas une perte, bon pour les bénéfices.' : (good ? 'Idée bonne' : 'Idée mauvaise ou invalidation.');
    const lines = [
      `## ${tradeId}`,
      '',
      `**Résultat** : ${data.outcome}`,
      `**Verdict** : ${verdictRevoked}`,
      '',
      data.note ? `**Note** : ${data.note}` : '',
      data.exit_price != null ? `**Prix de sortie** : ${data.exit_price}` : '',
      data.closed_at ? `**Clôturé le** : ${data.closed_at}` : '',
      '',
    ].filter(Boolean);
    const content = lines.join('\n');
    postMortems.push({ trade_id: tradeId, content, outcome: data.outcome, closed_at: closedAt });
    if (!byDate.has(closedAt)) byDate.set(closedAt, []);
    byDate.get(closedAt).push({ trade_id: tradeId, content, outcome: data.outcome });
  }

  for (const [date, items] of byDate) {
    const dailyPath = path.join(POST_MORTEM_DIR, `${date}.md`);
    const header = [
      `# Compte rendu Chase — ${date}`,
      '',
      `${items.length} trade(s) clôturé(s) ce jour.`,
      '',
      '---',
      '',
    ].join('\n');
    const sections = items.map((i) => i.content).join('\n\n---\n\n');
    fs.writeFileSync(dailyPath, header + sections + '\n\n---\n*Généré par chase-tracker.js. Feedback diffusé aux agents (TECHNICALS, SMART_MONEY, SENTIMENT_X, ORCHESTRATOR, RISK_JOURNAL).*', 'utf8');
  }

  const processedIds = loadProcessedOutcomeIds();
  const postMortemsNew = postMortems.filter((pm) => !processedIds.has(pm.trade_id));
  for (const pm of postMortemsNew) processedIds.add(pm.trade_id);
  if (postMortemsNew.length) saveProcessedOutcomeIds(processedIds);

  function outcomeLabel(outcome) {
    const o = (outcome || '').toLowerCase();
    if (o === 'loss') return 'perte (stop touché)';
    if (o === 'invalid_hit') return 'invalidation';
    if (o === 'target_hit') return 'objectif atteint';
    if (o === 'win') return 'gain';
    if (o === 'revoked') return 'annulé ou invalidation sans perte';
    return outcome;
  }
  function symbolFromTradeId(tid) {
    const m = (tid || '').match(/^idea_([A-Z0-9]+)_\d+$/i);
    return m ? m[1] : null;
  }
  function formatPostMortemSummary(pm) {
    const sym = symbolFromTradeId(pm.trade_id) || pm.trade_id;
    return `${sym} en ${outcomeLabel(pm.outcome)}`;
  }
  const summaryPhrases = postMortemsNew.length
    ? postMortemsNew.map(formatPostMortemSummary).join(', ') + '.'
    : '';

  const feedbackByAgent = {
    TECHNICALS: postMortemsNew.length
      ? `Les idées ${summaryPhrases} Continuez à fournir des tendances et des niveaux de qualité ; privilégiez les signaux confirmés par les indicateurs (RSI, MACD) pour les paires qui ont récemment pris une perte.`
      : 'Aucun post-mortem pour l’instant. Continuez à fournir des tendances et des niveaux de qualité.',
    SMART_MONEY: postMortemsNew.length
      ? `Résultats des trades : ${summaryPhrases} Affinez le funding et les signaux smart money (Dexscreener, Binance Copy) pour mieux filtrer les idées sur ces paires.`
      : 'Aucun nouveau post-mortem. Affinez le funding et les signaux smart money.',
    SENTIMENT_X: postMortemsNew.length
      ? `Résultats : ${summaryPhrases} Affinez les narratives et le sentiment (X) pour aligner les idées avec le marché sur les paires concernées.`
      : 'Aucun nouveau post-mortem. Affinez les narratives et le sentiment.',
    ORCHESTRATOR: postMortemsNew.length
      ? `Trades clôturés : ${summaryPhrases} Consolidez les signaux et ne proposez des idées sur les paires en perte récente que si les critères renforcés sont remplis (indicateurs RapidAPI, alignement Intel, confiance ≥ 75 %).`
      : 'Aucun nouveau post-mortem. Consolidez les signaux et les idées selon le feedback.',
    RISK_JOURNAL: postMortemsNew.length
      ? `Bilan : ${summaryPhrases} En cas de pertes récentes, les règles sont renforcées (R:R min 1,5, levier max 1). Maintenez la validation stricte.`
      : 'Aucun nouveau post-mortem. Maintenez les règles et la validation.',
    tibo: (() => {
      let t = postMortemsNew.length ? `Exécution : résultats ${summaryPhrases} ` : '';
      try {
        const fp = path.join(ROOT, 'data', 'dashboard', 'tibo_report.json');
        if (fs.existsSync(fp)) {
          const tr = JSON.parse(fs.readFileSync(fp, 'utf8'));
          t += `Côté exécution : ${tr.orders_today || 0} ordre(s) passés aujourd’hui, ${tr.pending_tp_count || 0} TP en attente.`;
        }
      } catch (_) {}
      return t || 'Consultez tibo_report.json et executed_orders.json pour le suivi exécution.';
    })(),
  };
  const feedbackJson = {
    timestamp_utc: new Date().toISOString(),
    post_mortem_count: postMortems.length,
    post_mortem_new_count: postMortemsNew.length,
    by_agent: feedbackByAgent,
  };
  fs.writeFileSync(path.join(ROOT, 'data', 'dashboard', 'chase_feedback.json'), JSON.stringify(feedbackJson, null, 2), 'utf8');
  for (const [agent, text] of Object.entries(feedbackByAgent)) {
    const fdPath = path.join(FEEDBACK_DIR, `${agent}.md`);
    fs.writeFileSync(fdPath, `# Feedback Chase pour ${agent}\n\n${text}\n`, 'utf8');
  }
  try {
    const { appendWire } = require('./wire-log.js');
    appendWire({
      from_agent: 'CHASE',
      to_agent: 'BROADCAST',
      type: 'SHARE_SIGNAL',
      context: { window: 'chase_feedback' },
      content_summary: `Post-mortems : ${postMortems.length} (${postMortemsNew.length} nouveau(x)) | feedback écrit pour ${Object.keys(feedbackByAgent).length} agents.`,
      content_ref: 'data/dashboard/chase_feedback.json',
    });
    appendWire({
      from_agent: 'CHASE',
      to_agent: 'BOSS',
      type: 'SHARE_SIGNAL',
      context: { window: 'chase_feedback' },
      content_summary: `Rapport post-mortems : ${postMortems.length} trade(s) clôturés, ${postMortemsNew.length} nouveau(x). Feedback pour risk et agents.`,
      content_ref: 'data/dashboard/chase_feedback.json',
    });
  } catch (_) {}

  // Diagnostic des pertes (causes communes : signaux, timing, conditions marché)
  try {
    const { runDiagnostic } = require('./chase-loss-diagnostic.js');
    runDiagnostic();
  } catch (e) {
    console.log('Chase: diagnostic pertes non exécuté —', (e && e.message) || e);
  }

  console.log('Chase: post-mortems', postMortems.length, '(', postMortemsNew.length, 'nouveau(x) diffusé(s)) | feedback écrit dans data/tracker/feedback/ et data/dashboard/chase_feedback.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
