#!/usr/bin/env node
/**
 * TradeEmpire — Vérifie les positions fermées, met à jour les outcomes, puis lance Chase.
 * 1) Lit data/tracker/closed_positions.json (liste manuelle : trade_id, outcome, exit_price?, closed_at?, note?).
 * 2) Optionnel : interroge ASTER (positionRisk) pour détecter les ordres exécutés dont la position est fermée (volume 0).
 * 3) Pour chaque trade clôturé, met à jour data/tracker/outcomes/{trade_id}.json (outcome, exit_price, closed_at, note).
 * 4) Lance chase-tracker.js pour générer les post-mortems et le rapport Chase.
 * Usage: node scripts/sync-closed-outcomes-and-chase.js [--detect]
 *   --detect : tente de détecter les positions fermées via ASTER (positionRisk).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CLOSED_POSITIONS_PATH = path.join(ROOT, 'data', 'tracker', 'closed_positions.json');
const OUTCOMES_DIR = path.join(ROOT, 'data', 'tracker', 'outcomes');
const EXECUTED_ORDERS_PATH = path.join(ROOT, 'data', 'dashboard', 'executed_orders.json');

function loadJson(p, def) {
  if (!fs.existsSync(p)) return def;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return def;
  }
}

function saveOutcome(tradeId, update) {
  const outPath = path.join(OUTCOMES_DIR, `${tradeId}.json`);
  if (!fs.existsSync(outPath)) {
    console.warn('Outcome absent pour', tradeId, '— ignoré.');
    return false;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  } catch (_) {
    console.warn('Outcome invalide pour', tradeId);
    return false;
  }
  if (data.outcome && data.outcome !== 'pending') {
    return false;
  }
  data.outcome = update.outcome;
  if (update.exit_price != null) data.exit_price = update.exit_price;
  if (update.closed_at) data.closed_at = update.closed_at;
  if (update.note) data.note = update.note;
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

async function detectClosedFromAstern() {
  let account;
  try {
    const { getAccount } = require('./aster-client.js');
    account = await getAccount();
  } catch (e) {
    console.warn('ASTER non disponible (détection positions fermées ignorée):', e.message);
    return [];
  }
  const positions = (account && account.positions) || [];
  const openSymbols = new Set();
  for (const p of positions) {
    const amt = parseFloat(p.positionAmt || '0');
    if (amt !== 0) openSymbols.add((p.symbol || '').toUpperCase());
  }
  const executed = loadJson(EXECUTED_ORDERS_PATH, []);
  const closed = [];
  for (const o of executed) {
    const symbol = (o.symbol || '').toUpperCase();
    if (!symbol) continue;
    if (!openSymbols.has(symbol)) {
      closed.push({
        trade_id: o.trade_id,
        outcome: 'loss',
        closed_at: new Date().toISOString().slice(0, 10),
        note: 'Position fermée (détectée via ASTER). Modifier outcome en win/target_hit si besoin.',
      });
    }
  }
  return closed;
}

function main() {
  const withDetect = process.argv.includes('--detect');
  if (!fs.existsSync(path.dirname(CLOSED_POSITIONS_PATH))) {
    fs.mkdirSync(path.dirname(CLOSED_POSITIONS_PATH), { recursive: true });
  }
  if (!fs.existsSync(OUTCOMES_DIR)) fs.mkdirSync(OUTCOMES_DIR, { recursive: true });

  const raw = loadJson(CLOSED_POSITIONS_PATH, null);
  const manual = Array.isArray(raw) ? raw : [];
  const toApply = manual.filter((u) => u.trade_id && (u.outcome === 'win' || u.outcome === 'loss' || u.outcome === 'invalid_hit' || u.outcome === 'target_hit' || u.outcome === 'revoked'));

  if (withDetect) {
    detectClosedFromAstern()
      .then((detected) => {
        for (const d of detected) {
          if (!toApply.some((t) => t.trade_id === d.trade_id)) toApply.push(d);
        }
        runSyncAndChase(toApply);
      })
      .catch((e) => {
        console.error(e);
        runSyncAndChase(toApply);
      });
  } else {
    runSyncAndChase(toApply);
  }
}

function runSyncAndChase(toApply) {
  let updated = 0;
  for (const u of toApply) {
    if (!u.trade_id || !u.outcome) continue;
    const ok = saveOutcome(u.trade_id, u);
    if (ok) {
      updated++;
      console.log('Outcome mis à jour:', u.trade_id, '→', u.outcome);
    }
  }
  if (updated === 0 && toApply.length) {
    console.log('Aucun outcome pending à mettre à jour (déjà complétés ou trade_id inconnu).');
  } else if (toApply.length === 0) {
    console.log('Aucune entrée dans', path.basename(CLOSED_POSITIONS_PATH), '. Remplir avec les trades clôturés (trade_id, outcome, closed_at, etc.).');
  }

  console.log('Lancement de Chase (chase-tracker.js)...');
  try {
    execSync(`node "${path.join(__dirname, 'chase-tracker.js')}"`, {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('Chase a échoué:', e.message);
    process.exit(1);
  }
}

main();
