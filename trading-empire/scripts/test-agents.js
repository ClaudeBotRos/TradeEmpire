#!/usr/bin/env node
/**
 * TradeEmpire — Test indépendant de chaque agent (script).
 * Exécute un ou tous les agents et valide leurs sorties (fichiers attendus, champs requis).
 * Usage:
 *   node test-agents.js                    → exécute les 5 agents dans l'ordre et valide chacun
 *   node test-agents.js technicals         → exécute uniquement TECHNICALS et valide
 *   node test-agents.js smart_money sentiment orchestrator risk_journal
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = {
  technicals: path.join(ROOT, 'data', 'signals', 'technicals'),
  smart_money: path.join(ROOT, 'data', 'signals', 'smart_money'),
  sentiment: path.join(ROOT, 'data', 'signals', 'sentiment'),
  ideas: path.join(ROOT, 'data', 'ideas'),
  decisions: path.join(ROOT, 'data', 'decisions'),
  journal: path.join(ROOT, 'data', 'journal'),
  wire: path.join(ROOT, 'data', 'dashboard', 'agent_exchanges.json'),
  intel: path.join(ROOT, 'data', 'dashboard', 'intel'),
  tracker: path.join(ROOT, 'data', 'tracker'),
};

const AGENTS = [
  { id: 'technicals', script: 'technicals-scan.js', validate: validateTechnicals },
  { id: 'smart_money', script: 'smart-money-scan.js', validate: validateSmartMoney },
  { id: 'sentiment', script: 'sentiment-scan.js', validate: validateSentiment },
  { id: 'orchestrator', script: 'orchestrator-scan.js', validate: validateOrchestrator },
  { id: 'risk_journal', script: 'risk-journal-scan.js', validate: validateRiskJournal },
  { id: 'intel', script: 'intel-scan.js', validate: validateIntel },
  { id: 'chase', script: 'chase-tracker.js', validate: validateChase },
];

function runScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  try {
    execSync(`node "${scriptPath}"`, { encoding: 'utf8', cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    return { ok: true };
  } catch (e) {
    const msg = [e.stderr, e.stdout, e.message].filter(Boolean).join(' ').trim().slice(0, 200);
    return { ok: false, message: msg || String(e) };
  }
}

function latestJsonInDir(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (!files.length) return null;
  files.sort().reverse();
  const filepath = path.join(dir, files[0]);
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/** Fichier JSON le plus récent par date de modification (sortie du run en cours). */
function newestJsonInDirByMtime(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (!files.length) return null;
  const withMtime = files.map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }));
  withMtime.sort((a, b) => b.mtime - a.mtime);
  const filepath = path.join(dir, withMtime[0].name);
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function allJsonInDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    } catch (_) {}
  }
  return out;
}

function validateTechnicals() {
  const data = newestJsonInDirByMtime(DATA.technicals);
  if (!data) return { ok: false, message: 'Aucun fichier dans data/signals/technicals/' };
  const missing = [];
  if (!data.timestamp_utc) missing.push('timestamp_utc');
  if (data.symbol == null) missing.push('symbol');
  if (data.trend == null) missing.push('trend');
  if (!data.levels || typeof data.levels !== 'object') missing.push('levels');
  if (data.volatility == null && data.volatility !== 0) missing.push('volatility');
  if (missing.length) return { ok: false, message: 'Champs manquants: ' + missing.join(', ') };
  return { ok: true, detail: `${data.symbol} ${data.timeframe || '4h'} trend=${data.trend}` };
}

function validateSmartMoney() {
  const data = newestJsonInDirByMtime(DATA.smart_money);
  if (!data) return { ok: false, message: 'Aucun fichier dans data/signals/smart_money/' };
  if (!data.timestamp_utc) return { ok: false, message: 'Champ timestamp_utc manquant' };
  if (data.symbol == null) return { ok: false, message: 'Champ symbol manquant' };
  if (!Array.isArray(data.signals)) return { ok: false, message: 'Champ signals (array) manquant' };
  return { ok: true, detail: `${data.symbol} signals=${data.signals.length}` };
}

function validateSentiment() {
  if (!fs.existsSync(DATA.sentiment)) return { ok: false, message: 'Dossier data/signals/sentiment/ absent' };
  const data = newestJsonInDirByMtime(DATA.sentiment);
  if (!data) return { ok: false, message: 'Aucun fichier dans data/signals/sentiment/' };
  if (!data.timestamp_utc && !data.narratives && !data.signals) return { ok: false, message: 'Fichier sentiment sans timestamp_utc ni narratives/signals' };
  const hasContent = (Array.isArray(data.narratives) && data.narratives.length) || (Array.isArray(data.signals) && data.signals.length);
  if (!hasContent) return { ok: false, message: 'narratives ou signals (array) manquant/vide' };
  return { ok: true, detail: `narratives=${(data.narratives || []).length}` };
}

function validateOrchestrator() {
  const ideas = allJsonInDir(DATA.ideas);
  const hasTechnicals = fs.existsSync(DATA.technicals) && fs.readdirSync(DATA.technicals).filter((f) => f.endsWith('.json')).length > 0;
  if (!hasTechnicals) {
    if (ideas.length === 0) return { ok: true, detail: 'Aucun signal technique → 0 idée (attendu)' };
  }
  for (const idea of ideas) {
    if (!idea.trade_id) return { ok: false, message: 'Une idée sans trade_id' };
    if (!idea.symbol) return { ok: false, message: `Idée ${idea.trade_id} sans symbol` };
    if (!idea.entry || idea.entry.price == null) return { ok: false, message: `Idée ${idea.trade_id} sans entry.price` };
    if (!idea.invalid || idea.invalid.price == null) return { ok: false, message: `Idée ${idea.trade_id} sans invalid.price` };
    if (!Array.isArray(idea.targets)) return { ok: false, message: `Idée ${idea.trade_id} sans targets` };
  }
  return { ok: true, detail: `${ideas.length} idée(s)` };
}

function validateRiskJournal() {
  const date = new Date().toISOString().slice(0, 10);
  const journalPath = path.join(DATA.journal, `${date}.md`);
  if (!fs.existsSync(journalPath)) return { ok: false, message: `Journal ${date}.md non créé` };
  const ideas = allJsonInDir(DATA.ideas).filter((i) => i.status === 'PROPOSED');
  const decisions = fs.existsSync(DATA.decisions) ? fs.readdirSync(DATA.decisions).filter((f) => f.endsWith('.json')) : [];
  if (ideas.length > 0 && decisions.length === 0) return { ok: false, message: 'Idées PROPOSED mais aucune décision écrite' };
  const content = fs.readFileSync(journalPath, 'utf8');
  if (!content.includes('Journal') && !content.includes('idée')) return { ok: false, message: 'Contenu journal invalide' };
  return { ok: true, detail: `journal ${date}.md, ${decisions.length} décision(s)` };
}

function validateIntel() {
  const trendPath = path.join(DATA.intel, 'trend_cards.json');
  if (!fs.existsSync(trendPath)) return { ok: false, message: 'trend_cards.json absent (data/dashboard/intel/)' };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(trendPath, 'utf8'));
  } catch (_) {
    return { ok: false, message: 'trend_cards.json invalide' };
  }
  if (!data.timestamp_utc && !data.date) return { ok: false, message: 'Champs timestamp_utc ou date manquants' };
  if (!Array.isArray(data.cards)) return { ok: false, message: 'Champ cards (array) manquant' };
  if (!data.cards.length) return { ok: false, message: 'Aucune Trend Card produite (attendu au moins une carte X)' };
  return { ok: true, detail: `${data.cards.length} carte(s) (X: ${data.cards.filter((c) => c.source === 'x').length}, YouTube: ${data.cards.filter((c) => c.source === 'youtube').length})` };
}

function validateChase() {
  if (!fs.existsSync(DATA.tracker)) return { ok: false, message: 'data/tracker/ absent' };
  const outcomes = path.join(DATA.tracker, 'outcomes');
  const postMortem = path.join(DATA.tracker, 'post_mortem');
  const feedback = path.join(DATA.tracker, 'feedback');
  if (!fs.existsSync(outcomes) || !fs.statSync(outcomes).isDirectory()) return { ok: false, message: 'data/tracker/outcomes/ manquant' };
  if (!fs.existsSync(postMortem) || !fs.statSync(postMortem).isDirectory()) return { ok: false, message: 'data/tracker/post_mortem/ manquant' };
  if (!fs.existsSync(feedback) || !fs.statSync(feedback).isDirectory()) return { ok: false, message: 'data/tracker/feedback/ manquant' };
  const feedbackJson = path.join(ROOT, 'data', 'dashboard', 'chase_feedback.json');
  const hasFeedback = fs.existsSync(feedbackJson);
  try {
    if (hasFeedback) JSON.parse(fs.readFileSync(feedbackJson, 'utf8'));
  } catch (_) {
    return { ok: false, message: 'chase_feedback.json invalide' };
  }
  return { ok: true, detail: `outcomes/post_mortem/feedback OK${hasFeedback ? ', chase_feedback.json présent' : ''}` };
}

function validateWire() {
  if (!fs.existsSync(DATA.wire)) return { ok: false, message: 'agent_exchanges.json absent' };
  let list;
  try {
    list = JSON.parse(fs.readFileSync(DATA.wire, 'utf8'));
  } catch (_) {
    return { ok: false, message: 'agent_exchanges.json invalide' };
  }
  if (!Array.isArray(list)) return { ok: false, message: 'agent_exchanges.json doit être un tableau' };
  const morning = list.filter((e) => e.context && e.context.window === 'morning_brief');
  if (morning.length < 5) return { ok: false, message: `Wire: attendu au moins 5 entrées morning_brief, trouvé ${morning.length}` };
  const agents = new Set(morning.map((e) => e.from_agent));
  const expected = new Set(['TECHNICALS', 'SMART_MONEY', 'SENTIMENT_X', 'ORCHESTRATOR', 'RISK_JOURNAL']);
  for (const a of expected) {
    if (!agents.has(a)) return { ok: false, message: `Wire: aucun échange from ${a}` };
  }
  return { ok: true, detail: `${list.length} échange(s), ${morning.length} morning_brief` };
}

function main() {
  const rawArgs = process.argv.slice(2);
  const isFull = rawArgs[0] === '--full';
  const args = (isFull ? rawArgs.slice(1) : rawArgs).map((a) => a.toLowerCase().replace(/-/g, '_'));

  if (isFull) {
    console.log('TradeEmpire — Test d’intégration (run-morning + Wire)\n');
    process.stdout.write('run-morning.js... ');
    const run = runScript('run-morning.js');
    if (!run.ok) {
      console.log('FAIL', run.message ? run.message.slice(0, 120) : '');
      process.exit(1);
    }
    console.log('OK');
    process.stdout.write('intel-scan.js... ');
    const runIntel = runScript('intel-scan.js');
    if (!runIntel.ok) console.log('FAIL', runIntel.message ? runIntel.message.slice(0, 80) : ''); else console.log('OK');
    process.stdout.write('chase-tracker.js... ');
    const runChase = runScript('chase-tracker.js');
    if (!runChase.ok) console.log('FAIL', runChase.message ? runChase.message.slice(0, 80) : ''); else console.log('OK');
    console.log('\nValidation des sorties :');
    let failed = 0;
    for (const agent of AGENTS) {
      process.stdout.write(`  ${agent.id} : `);
      const valid = agent.validate();
      if (!valid.ok) {
        console.log('FAIL', valid.message);
        failed++;
      } else {
        console.log('OK', valid.detail || '');
      }
    }
    process.stdout.write('  wire : ');
    const wireValid = validateWire();
    if (!wireValid.ok) {
      console.log('FAIL', wireValid.message);
      failed++;
    } else {
      console.log('OK', wireValid.detail || '');
    }
    console.log('\n' + (failed ? `${failed} vérification(s) en échec.` : 'Intégration OK (run-morning + Intel + Chase + Wire).'));
    process.exit(failed ? 1 : 0);
  }

  const toRun = args.length ? AGENTS.filter((a) => args.includes(a.id)) : AGENTS;
  if (toRun.length === 0) {
    console.error('Usage: node test-agents.js [--full] [technicals|smart_money|sentiment|orchestrator|risk_journal|intel|chase]...');
    process.exit(1);
  }

  console.log('TradeEmpire — Test des agents\n');
  let failed = 0;
  for (const agent of toRun) {
    process.stdout.write(`${agent.id} : exécution... `);
    const run = runScript(agent.script);
    if (!run.ok) {
      console.log('FAIL (exécution)', run.message ? run.message.slice(0, 80) : '');
      failed++;
      continue;
    }
    process.stdout.write('sortie OK, validation... ');
    const valid = agent.validate();
    if (!valid.ok) {
      console.log('FAIL (validation)', valid.message);
      failed++;
      continue;
    }
    console.log('OK', valid.detail || '');
  }
  console.log('\n' + (failed ? `${failed} agent(s) en échec.` : 'Tous les agents ont réussi.'));
  process.exit(failed ? 1 : 0);
}

main();
