#!/usr/bin/env node
/**
 * TradeEmpire — Orchestrator : lit signaux (technicals, smart_money, sentiment), produit des TRADE_IDEA dans data/ideas/
 * Usage: node orchestrator-scan.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TECHNICALS_DIR = path.join(ROOT, 'data', 'signals', 'technicals');
const SMART_MONEY_DIR = path.join(ROOT, 'data', 'signals', 'smart_money');
const SENTIMENT_DIR = path.join(ROOT, 'data', 'signals', 'sentiment');
const IDEAS_DIR = path.join(ROOT, 'data', 'ideas');
const MAX_IDEAS = 7;
const MIN_RR = 1.2;
const MAX_LOSS_USD = 50;
const DEFAULT_LEVERAGE = 1;
const POSITION_SIZE_USD = 500;

function loadLatestBySymbol(dir, getSymbol) {
  if (!fs.existsSync(dir)) return {};
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const bySymbol = {};
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const sym = getSymbol(data);
      if (!sym) continue;
      const existing = bySymbol[sym];
      const ts = (data.timestamp_utc || '').replace(/[-:T.Z]/g, '');
      if (!existing || (data.timestamp_utc && ts > (existing.timestamp_utc || '').replace(/[-:T.Z]/g, ''))) {
        bySymbol[sym] = data;
      }
    } catch (_) {}
  }
  return bySymbol;
}

function loadLatestTechnicalsBySymbol() {
  if (!fs.existsSync(TECHNICALS_DIR)) return {};
  const files = fs.readdirSync(TECHNICALS_DIR).filter((f) => f.endsWith('.json'));
  const byKey = {};
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(TECHNICALS_DIR, f), 'utf8'));
      const key = `${data.symbol || ''}_${data.timeframe || '4h'}`;
      const ts = (data.timestamp_utc || '').replace(/[-:T.Z]/g, '');
      if (!byKey[key] || ts > (byKey[key].timestamp_utc || '').replace(/[-:T.Z]/g, '')) {
        byKey[key] = data;
      }
    } catch (_) {}
  }
  return byKey;
}

function loadSentimentDigest(date) {
  const filepath = path.join(SENTIMENT_DIR, `${date}_x_digest.json`);
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function buildEvidence(tech, sm, sentiment, symbol) {
  const technicals = [];
  if (tech) {
    if (tech.trend) technicals.push(`trend ${tech.trend}`);
    if (tech.levels && tech.levels.support?.length) technicals.push('support levels');
    if (tech.levels && tech.levels.resistance?.length) technicals.push('resistance levels');
  }
  const sentimentList = [];
  if (sentiment) {
    const s = sentiment.sentiment_by_symbol?.[symbol] || 'neutral';
    sentimentList.push(`sentiment ${s}`);
    if (sentiment.narratives?.length) sentimentList.push(sentiment.narratives[0]);
  }
  const smartMoney = [];
  if (sm && sm.signals?.length) smartMoney.push(...sm.signals);
  return {
    technicals: technicals.length ? technicals : ['no technicals'],
    sentiment: sentimentList.length ? sentimentList : ['neutral'],
    smart_money: smartMoney.length ? smartMoney : ['no smart_money'],
  };
}

function buildIdea(symbol, timeframe, tech, sm, sentiment) {
  const trend = tech?.trend || 'range';
  if (trend === 'range') return null;

  const direction = trend === 'up' ? 'LONG' : 'SHORT';
  const supports = (tech?.levels?.support || []).filter((n) => typeof n === 'number').sort((a, b) => a - b);
  const resistances = (tech?.levels?.resistance || []).filter((n) => typeof n === 'number').sort((a, b) => a - b);
  if (!supports.length && !resistances.length) return null;

  const lastSupport = supports[supports.length - 1];
  const firstResistance = resistances[0];
  const priceRef = sm?.metrics?.mark_price || lastSupport || firstResistance || 60000;

  let entryPrice, invalidPrice, target1, target2;
  if (direction === 'LONG') {
    entryPrice = lastSupport || priceRef * 0.98;
    invalidPrice = entryPrice * 0.99;
    const risk = entryPrice - invalidPrice;
    target1 = entryPrice + risk * MIN_RR;
    target2 = entryPrice + risk * (MIN_RR * 2);
  } else {
    entryPrice = firstResistance || priceRef * 1.02;
    invalidPrice = entryPrice * 1.01;
    const risk = invalidPrice - entryPrice;
    target1 = entryPrice - risk * MIN_RR;
    target2 = entryPrice - risk * (MIN_RR * 2);
  }

  const now = new Date();
  const tradeId = `idea_${symbol}_${now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;

  const idea = {
    timestamp_utc: now.toISOString(),
    symbol,
    timeframe: timeframe || '4H',
    direction,
    setup_name: trend === 'up' ? 'breakout_retest' : 'breakout_retest',
    entry: { type: 'limit', price: Math.round(entryPrice * 100) / 100 },
    invalid: { type: 'price', price: Math.round(invalidPrice * 100) / 100, description: 'invalidation level' },
    targets: [
      { price: Math.round(target1 * 100) / 100, rr: MIN_RR },
      { price: Math.round(target2 * 100) / 100, rr: MIN_RR * 2 },
    ],
    confidence: 0.5 + (sentiment?.low_confidence ? 0 : 0.1) + (sm?.low_confidence ? 0 : 0.1),
    evidence: buildEvidence(tech, sm, sentiment, symbol),
    risk: {
      max_loss_usd: MAX_LOSS_USD,
      position_size_usd: POSITION_SIZE_USD,
      leverage: DEFAULT_LEVERAGE,
    },
    constraints: { max_positions_open: 3 },
    sources: [
      { type: 'exchange', ref: 'binance_klines_4h' },
      { type: 'exchange', ref: 'binance_futures_premiumIndex' },
      { type: 'stub', ref: 'sentiment_digest' },
    ],
    status: 'PROPOSED',
    trade_id: tradeId,
  };

  if (idea.confidence > 1) idea.confidence = 1;

  const riskDist = direction === 'LONG' ? entryPrice - invalidPrice : invalidPrice - entryPrice;
  const target1Price = idea.targets[0]?.price;
  const gain1 = target1Price != null ? (direction === 'LONG' ? target1Price - entryPrice : entryPrice - target1Price) : riskDist * MIN_RR;
  const rrActual = riskDist > 0 ? (gain1 / riskDist) : MIN_RR;
  idea.description = [
    `${direction} ${symbol} sur timeframe ${timeframe || '4H'}.`,
    `Entrée proposée: ${idea.entry.price}, invalidation si le prix atteint ${idea.invalid.price} (niveau d’invalidation).`,
    `Objectif 1: ${idea.targets[0]?.price ?? '—'} (R:R ${(idea.targets[0]?.rr ?? rrActual).toFixed(1)} = pour 1 unité de risque, gain cible ${(idea.targets[0]?.rr ?? rrActual).toFixed(1)} unités).`,
    `Confidence ${(idea.confidence * 100).toFixed(0)}%: score agrégé basé sur la qualité des signaux techniques (trend, levels), du sentiment X et des indicateurs smart money (funding). Plus le score est élevé, plus les sources sont considérées fiables.`,
  ].join(' ');
  idea.glossary = {
    rr: 'R:R = Risk:Reward. Ratio gain cible / perte max (ex: 1.2 = pour 1€ risqué, gain cible 1,20€).',
    confidence: 'Confidence = score 0–1 (0–100%) basé sur la qualité des signaux: techniques (trend, niveaux), sentiment X, smart money (funding).',
    invalid: 'Invalidation = niveau de prix qui invalide l’idée (stop: si atteint, le scénario est considéré faux).',
  };

  return idea;
}

function main() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const technicalsByKey = loadLatestTechnicalsBySymbol();
  const smartMoneyBySymbol = loadLatestBySymbol(SMART_MONEY_DIR, (d) => d.symbol);
  const sentiment = loadSentimentDigest(date);

  if (!fs.existsSync(IDEAS_DIR)) {
    fs.mkdirSync(IDEAS_DIR, { recursive: true });
  }

  const ideas = [];
  const bySymbol = {};
  for (const key of Object.keys(technicalsByKey)) {
    const tech = technicalsByKey[key];
    const symbol = tech.symbol;
    if (!symbol) continue;
    const tf = (tech.timeframe || '4h').toLowerCase();
    if (!bySymbol[symbol] || tf === '4h') bySymbol[symbol] = tech;
  }

  for (const symbol of Object.keys(bySymbol)) {
    if (ideas.length >= MAX_IDEAS) break;
    const tech = bySymbol[symbol];
    const sm = smartMoneyBySymbol[symbol] || null;
    const idea = buildIdea(symbol, tech.timeframe, tech, sm, sentiment);
    if (idea) ideas.push(idea);
  }

  for (const idea of ideas) {
    const filepath = path.join(IDEAS_DIR, `${idea.trade_id}.json`);
    fs.writeFileSync(filepath, JSON.stringify(idea, null, 2), 'utf8');
    console.log('OK', filepath);
  }

  if (!ideas.length) {
    console.log('No ideas produced (no technicals with trend or levels).');
  }
}

main();
