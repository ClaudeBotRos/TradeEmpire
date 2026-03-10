#!/usr/bin/env node
/**
 * TradeEmpire — Rapport quotidien Yield Farmer.
 * Lit le capital disponible (executor_balance / tibo_report), produit une recommandation
 * d'allocation et écrit data/dashboard/yield_farmer_report.json.
 * Usage: node scripts/yield-report.js
 * Voir docs/PLAN_YIELD_FARMING.md.
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'data', 'dashboard', 'yield_farmer_report.json');
const CONFIG_PATH = path.join(ROOT, 'data', 'dashboard', 'yield_farmer_config.json');
const BALANCE_PATH = path.join(ROOT, 'data', 'dashboard', 'executor_balance.json');
const TIBO_PATH = path.join(ROOT, 'data', 'dashboard', 'tibo_report.json');

// Part du capital "dormant" qu'on peut envisager pour le yield (reste pour trading)
const ALLOCATION_PCT = 0.5; // 50 % du disponible au max en phase 1
const APY_CIBLE_PCT = 8;
const SEUIL_APY_MIN_PCT = 5;

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function main() {
  const balance = readJson(BALANCE_PATH);
  const tibo = readJson(TIBO_PATH);
  const available =
    (balance && (balance.available_balance_usdt != null ? parseFloat(balance.available_balance_usdt) : null)) ??
    (tibo?.balance_snapshot?.available_balance_usdt != null ? parseFloat(tibo.balance_snapshot.available_balance_usdt) : null);

  const capitalDormant = available != null && Number.isFinite(available) ? Math.max(0, available * ALLOCATION_PCT) : null;
  const recommandationUsdt =
    capitalDormant != null && capitalDormant >= 5 ? Math.min(capitalDormant, 80) : 0; // plafond 80 USDT phase 1

  const config = readJson(CONFIG_PATH) || {};
  const platform = config.platform || 'uniswap_v3';
  const asset = config.asset || 'USDT';
  const pair = config.pair || 'USDC/USDT';
  const walletAddress = config.wallet_address || null;
  const chain = config.chain || 'arbitrum';

  const poolsCibles = [
    { protocol: 'Uniswap V3', asset: pair, chain, apy_indicatif_pct: 8, note: 'Paire stable USDC/USDT sur Arbitrum, fee 0.01% ou 0.05%. Données APY via The Graph (THE_GRAPH_API_KEY_UNISWAP).' },
  ].filter((p) => (p.apy_indicatif_pct || 0) >= SEUIL_APY_MIN_PCT);

  const rendementAnnuel =
    recommandationUsdt > 0 && APY_CIBLE_PCT > 0 ? (recommandationUsdt * APY_CIBLE_PCT) / 100 : null;

  const report = {
    timestamp_utc: new Date().toISOString(),
    source: 'yield_farmer',
    chain,
    wallet_address: walletAddress || config.wallet_address,
    platform: config.platform || 'uniswap_v3',
    asset: config.asset || 'USDT',
    pair: config.pair || 'USDC/USDT',
    capital_dormant_estime_usdt: capitalDormant,
    capital_disponible_source_usdt: available,
    recommandation_allocation_usdt: recommandationUsdt,
    apy_cible_pct: APY_CIBLE_PCT,
    seuil_apy_min_pct: SEUIL_APY_MIN_PCT,
    pools_cibles: poolsCibles,
    capital_alloue_usdt: null,
    pool_actuel: null,
    apy_estime_pct: null,
    rendement_annuel_estime_usdt: rendementAnnuel,
    rendement_mensuel_estime_usdt: rendementAnnuel != null ? rendementAnnuel / 12 : null,
    alertes: [],
    summary:
      capitalDormant != null && recommandationUsdt > 0
        ? `Capital dormant estimé : ${capitalDormant.toFixed(0)} USDT. Recommandation : allouer jusqu'à ${recommandationUsdt} USDT sur Uniswap V3 (${pair}, APY cible 5-15%). Rendement annuel estimé (${APY_CIBLE_PCT}%) : ${(rendementAnnuel || 0).toFixed(2)} USDT.`
        : 'Capital disponible insuffisant ou non disponible. Exécuter executor-run.js pour rafraîchir executor_balance.json.',
  };

  const dir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  try {
    const { appendWire } = require('./wire-log.js');
    appendWire({
      from_agent: 'YIELD_FARMER',
      to_agent: 'BOSS',
      type: 'SHARE_SIGNAL',
      context: { window: 'yield_farmer_report' },
      content_summary: report.summary || 'Rapport yield (capital dormant, pools, APY cible).',
      content_ref: 'data/dashboard/yield_farmer_report.json',
    });
  } catch (_) {}
  console.log(report.summary);
  console.log('Rapport écrit :', REPORT_PATH);
}

main();
