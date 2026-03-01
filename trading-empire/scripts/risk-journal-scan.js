#!/usr/bin/env node
/**
 * TradeEmpire — Risk & Journal : lit les idées PROPOSED, applique risk_rules, écrit data/decisions/ et data/journal/{date}.md
 * Usage: node risk-journal-scan.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const DECISIONS_DIR = path.join(ROOT, 'data', 'decisions');
const JOURNAL_DIR = path.join(ROOT, 'data', 'journal');
const TRACKER_OUTCOMES_DIR = path.join(ROOT, 'data', 'tracker', 'outcomes');
const RISK_RULES_PATH = path.join(ROOT, 'rules', 'risk_rules.md');

const MAX_LOSS_PER_TRADE = 50;
const MAX_LOSS_PER_DAY = 150;
const MAX_LEVERAGE = 2;
const MIN_RR = 1.2;

function parseRiskRules() {
  if (!fs.existsSync(RISK_RULES_PATH)) {
    return { maxLossPerTrade: MAX_LOSS_PER_TRADE, maxLeverage: MAX_LEVERAGE, minRR: MIN_RR };
  }
  const content = fs.readFileSync(RISK_RULES_PATH, 'utf8');
  const maxLossMatch = content.match(/Max perte par trade\s*:\s*(\d+)/i);
  const leverageMatch = content.match(/Leverage max\s*:\s*(\d+)/i);
  const rrMatch = content.match(/R:R minimum\s*\(?ex\.\s*(\d+(?:\.\d+)?)/i);
  return {
    maxLossPerTrade: maxLossMatch ? parseInt(maxLossMatch[1], 10) : MAX_LOSS_PER_TRADE,
    maxLeverage: leverageMatch ? parseInt(leverageMatch[1], 10) : MAX_LEVERAGE,
    minRR: rrMatch ? parseFloat(rrMatch[1]) : MIN_RR,
  };
}

function getProposedIdeas() {
  if (!fs.existsSync(IDEAS_DIR)) return [];
  const files = fs.readdirSync(IDEAS_DIR).filter((f) => f.endsWith('.json'));
  const ideas = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(IDEAS_DIR, f), 'utf8'));
      if (data.status === 'PROPOSED') ideas.push(data);
    } catch (_) {}
  }
  return ideas;
}

function validateIdea(idea, rules) {
  if (!idea.risk) return { status: 'NEED_MORE_INFO', reason: 'Missing risk object' };
  if (idea.risk.max_loss_usd > rules.maxLossPerTrade) {
    return { status: 'REJECTED', reason: `max_loss_usd ${idea.risk.max_loss_usd} exceeds max ${rules.maxLossPerTrade}` };
  }
  if ((idea.risk.leverage || 1) > rules.maxLeverage) {
    return { status: 'REJECTED', reason: `leverage ${idea.risk.leverage} exceeds max ${rules.maxLeverage}` };
  }
  if (!idea.targets || !idea.targets.length) {
    return { status: 'NEED_MORE_INFO', reason: 'Missing targets' };
  }
  const minTargetRR = Math.min(...idea.targets.map((t) => t.rr || 0));
  if (minTargetRR < rules.minRR) {
    return { status: 'REJECTED', reason: `R:R ${minTargetRR} below minimum ${rules.minRR}` };
  }
  if (!idea.entry || !idea.invalid) {
    return { status: 'NEED_MORE_INFO', reason: 'Missing entry or invalid' };
  }
  const entryPrice = idea.entry.price;
  const invalidPrice = idea.invalid.price;
  if (idea.direction === 'LONG' && entryPrice <= invalidPrice) {
    return { status: 'REJECTED', reason: 'LONG: entry must be above invalid' };
  }
  if (idea.direction === 'SHORT' && entryPrice >= invalidPrice) {
    return { status: 'REJECTED', reason: 'SHORT: entry must be below invalid' };
  }
  return { status: 'APPROVED', reason: 'Conforms to risk_rules' };
}

function main() {
  const rules = parseRiskRules();
  const ideas = getProposedIdeas();

  if (!fs.existsSync(DECISIONS_DIR)) fs.mkdirSync(DECISIONS_DIR, { recursive: true });
  if (!fs.existsSync(JOURNAL_DIR)) fs.mkdirSync(JOURNAL_DIR, { recursive: true });

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const timestampUtc = now.toISOString();

  const decisions = [];

  for (const idea of ideas) {
    const tradeId = idea.trade_id || `idea_${idea.symbol}_${Date.now()}`;
    const validation = validateIdea(idea, rules);

    const decision = {
      trade_id: tradeId,
      status: validation.status,
      timestamp_utc: timestampUtc,
      reason: validation.reason,
      idea_ref: path.join('data', 'ideas', `${tradeId}.json`),
    };

    const decisionPath = path.join(DECISIONS_DIR, `${tradeId}_${validation.status}.json`);
    fs.writeFileSync(decisionPath, JSON.stringify(decision, null, 2), 'utf8');
    console.log('OK', decisionPath);
    decisions.push({ idea, decision, validation });

    idea.status = validation.status;
    const ideaPath = path.join(IDEAS_DIR, `${tradeId}.json`);
    if (fs.existsSync(ideaPath)) {
      fs.writeFileSync(ideaPath, JSON.stringify(idea, null, 2), 'utf8');
    }
    if (validation.status === 'APPROVED') {
      if (!fs.existsSync(TRACKER_OUTCOMES_DIR)) fs.mkdirSync(TRACKER_OUTCOMES_DIR, { recursive: true });
      const outcomePath = path.join(TRACKER_OUTCOMES_DIR, `${tradeId}.json`);
      if (!fs.existsSync(outcomePath)) {
        const outcome = {
          trade_id: tradeId,
          outcome: 'pending',
          approved_at: timestampUtc,
          symbol: idea.symbol,
          direction: idea.direction,
          entry: idea.entry?.price,
          invalid: idea.invalid?.price,
          targets: idea.targets,
          note: 'Remplir outcome (win|loss|invalid_hit|target_hit), optionnel: exit_price, closed_at, note.',
        };
        fs.writeFileSync(outcomePath, JSON.stringify(outcome, null, 2), 'utf8');
      }
    }
  }

  const journalLines = [
    `# Journal du jour ${date}`,
    '',
    `Généré le ${timestampUtc} UTC.`,
    '',
    `## Idées proposées : ${ideas.length}`,
    '',
  ];

  if (!decisions.length) {
    journalLines.push('Aucune idée en statut PROPOSED.');
  } else {
    for (const { idea, validation } of decisions) {
      journalLines.push(`### ${idea.trade_id} — ${idea.symbol} ${idea.direction} (${idea.setup_name})`);
      journalLines.push(`- Décision : **${validation.status}**`);
      journalLines.push(`- Raison : ${validation.reason}`);
      journalLines.push('');
    }
  }

  journalLines.push('---');
  journalLines.push('*Post-mortem : aucune exécution automatique en V1.*');

  const journalPath = path.join(JOURNAL_DIR, `${date}.md`);
  fs.writeFileSync(journalPath, journalLines.join('\n'), 'utf8');
  console.log('OK', journalPath);
}

main();
