#!/usr/bin/env node
/**
 * TradeEmpire — Recovery intraday AVEC analyse contextuelle (agent) + secours règle simple.
 * 1) technicals-scan.js (tendance à jour)
 * 2) recovery-intraday-context.js (contexte : ordres + technicals + Scout + Chase)
 * 3) Agent lit le contexte, analyse (tendance, Scout, Chase), écrit recovery_agent_recommendations.json
 *    → si timeout ou erreur provider, on continue : l’étape 4 utilisera la règle simple
 * 4) recovery-intraday-review.js --md --apply-cancel (applique les reco agent si fichier récent, sinon règle simple)
 *
 * Usage: node scripts/run-recovery-intraday-standalone.js
 * Crontab (Europe/Paris) : 30 12 * * * ... | 30 15 * * * ... | 0 18 * * * ...
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT || path.join(ROOT, '..', '..', '..');
const TIMEOUT_SCRIPT = 120000;
const TIMEOUT_AGENT = 180000;

const RECOVERY_AGENT_MESSAGE = [
  'Tu es Recovery Analyst. Depuis la racine du workspace (~/.openclaw/workspace),',
  'lis le fichier TradeEmpire/trading-empire/data/dashboard/recovery_intraday_context.json.',
  'Pour chaque ordre dans open_orders, décide action (keep ou cancel) et une raison courte',
  'en tenant compte de : tendance (technicals_by_symbol), résumé Scout (scout_summary),',
  'feedback Chase (chase_summary, chase_recent_loss_symbols).',
  'Écris le résultat dans TradeEmpire/trading-empire/data/dashboard/recovery_agent_recommendations.json',
  'avec exactement ce format : { "timestamp_utc": "<ISO>", "recommendations": [ { "orderId": <number>, "symbol": "<SYMBOL>", "action": "keep" ou "cancel", "reason": "<texte>" } ] }.',
  'Réponds par une seule ligne : Recovery analyse : N ordres, K cancel.',
].join(' ');

function run(name, cmd, opts = {}) {
  console.log('[recovery-standalone]', name);
  try {
    execSync(cmd, {
      cwd: opts.cwd || ROOT,
      stdio: 'inherit',
      timeout: opts.timeout || TIMEOUT_SCRIPT,
      ...opts,
    });
  } catch (e) {
    if (opts.allowFail) {
      console.warn('[recovery-standalone]', name, 'failed (continue):', e.message || e);
      return;
    }
    console.error('[recovery-standalone]', name, 'failed:', e.message || e);
    process.exit(1);
  }
}

run('Technicals (tendance à jour)', 'node scripts/technicals-scan.js');
run('Contexte (ordres + Scout + Chase)', 'node scripts/recovery-intraday-context.js');

try {
  console.log('[recovery-standalone] Agent (analyse contextuelle)');
  execSync('openclaw', ['agent', '--agent', 'main', '-m', RECOVERY_AGENT_MESSAGE], {
    cwd: OPENCLAW_ROOT,
    stdio: 'inherit',
    timeout: TIMEOUT_AGENT,
  });
} catch (e) {
  console.warn('[recovery-standalone] Agent failed (continue avec règle simple):', e.message || e);
}

run('Apply (reco agent ou règle simple) + annulations', 'node scripts/recovery-intraday-review.js --md --apply-cancel');

console.log('[recovery-standalone] Done.');
process.exit(0);
