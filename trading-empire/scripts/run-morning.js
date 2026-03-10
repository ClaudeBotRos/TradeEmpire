#!/usr/bin/env node
/**
 * TradeEmpire — Séquence matin : INTEL → TECHNICALS → SMART_MONEY → SENTIMENT_X → ORCHESTRATOR → RISK_JOURNAL → BROADCAST
 * Chaque étape enregistre un échange dans data/dashboard/agent_exchanges.json (Wire).
 * Usage: node scripts/run-morning.js
 * Depuis la racine trading-empire/ ou workspace (node TradeEmpire/trading-empire/scripts/run-morning.js)
 */

const { execSync } = require('child_process');
const path = require('path');
const { appendWire } = require('./wire-log.js');

const ROOT = path.join(__dirname, '..');
let chaseFeedbackLoader;
try {
  chaseFeedbackLoader = require('./chase-feedback-loader.js');
} catch (_) {
  chaseFeedbackLoader = null;
}
const STEPS = [
  { script: 'economic-calendar-scan.js', from: 'INTEL', to: 'ORCHESTRATOR', summary: 'Calendrier économique (dates/heures clés, actuals).', ref: 'data/dashboard/intel/economic_calendar.json' },
  { script: 'cryptodaily-news.js', from: 'INTEL', to: 'ORCHESTRATOR', summary: 'Actualités crypto (CryptoDaily RapidAPI).', ref: 'data/dashboard/intel/cryptodaily_news.json' },
  { script: 'reddit-intel.js', from: 'INTEL', to: 'ORCHESTRATOR', summary: 'Reddit — subreddits crypto similaires (RapidAPI).', ref: 'data/dashboard/intel/reddit_intel.json' },
  { script: 'intel-scan.js', from: 'INTEL', to: 'ORCHESTRATOR', summary: 'Trend Cards X + YouTube + macro + CryptoDaily + Reddit (narrative du jour pour orchestrator).', ref: 'data/dashboard/intel/trend_cards.json' },
  { script: 'news-scan.js', from: 'NEWS_SCAN', to: 'ORCHESTRATOR', summary: 'Catalysts CryptoDaily + Coindesk + X (Parvati) pour SENTIMENT_X.', ref: 'data/dashboard/intel/news_scan_report.json' },
  { script: 'technicals-scan.js', from: 'TECHNICALS', to: 'ORCHESTRATOR', summary: 'Signaux techniques (OHLCV, trend, levels) écrits.', ref: 'data/signals/technicals/' },
  { script: 'crypto-indicators-rapidapi.js', from: 'TECHNICALS', to: 'ORCHESTRATOR', summary: 'Indicateurs RSI/MACD/EMA (RapidAPI) pour enrichir les idées.', ref: 'data/signals/technicals/crypto_indicators_rapidapi.json' },
  { script: 'smart-money-scan.js', from: 'SMART_MONEY', to: 'ORCHESTRATOR', summary: 'Signaux smart money (funding) écrits.', ref: 'data/signals/smart_money/' },
  { script: 'smart-money-discover-wallets.js', from: 'SMART_MONEY', to: 'SMART_MONEY', summary: 'Découverte wallets Dexscreener (Apify) → dexscreener_wallets.txt.', ref: 'data/signals/smart_money/dexscreener_wallets.txt' },
  { script: 'dexscreener-top-traders.js', from: 'SMART_MONEY', to: 'ORCHESTRATOR', summary: 'Holders Dexscreener pour les wallets listés.', ref: 'data/signals/smart_money/dexscreener_holders.json' },
  { script: 'smart-money-discover-portfolios.js', from: 'SMART_MONEY', to: 'SMART_MONEY', summary: 'Découverte portfolio IDs Binance Copy (Apify) → binance_copy_portfolio_ids.txt.', ref: 'data/signals/smart_money/binance_copy_portfolio_ids.txt' },
  { script: 'binance-copy-leaderboard.js', from: 'SMART_MONEY', to: 'ORCHESTRATOR', summary: 'Leaderboard Binance Copy Trading (tops + portfolios).', ref: 'data/signals/smart_money/binance_copy_leaderboard.json' },
  { script: 'sentiment-scan.js', from: 'SENTIMENT_X', to: 'ORCHESTRATOR', summary: 'Signaux sentiment (narratives X) écrits.', ref: 'data/signals/sentiment/' },
  { script: 'enrich-sentiment-flow.js', from: 'SENTIMENT_X', to: 'ORCHESTRATOR', summary: 'Sentiment enrichi ventes/achats (funding rate).', ref: 'data/signals/sentiment/*_sentiment_flow.json' },
  { script: 'orchestrator-scan.js', from: 'ORCHESTRATOR', to: 'RISK_JOURNAL', summary: 'Idées TRADE_IDEA produites à partir des signaux.', ref: 'data/ideas/' },
  { script: 'build-niches-fiches.js', from: 'ORCHESTRATOR', to: 'BROADCAST', summary: 'Fiches Niches scorées mises à jour.', ref: 'data/dashboard/niches/' },
  { script: 'risk-journal-scan.js', from: 'RISK_JOURNAL', to: 'BROADCAST', summary: 'Décisions (APPROVED/REJECTED) et journal du jour écrits.', ref: 'data/decisions/ et data/journal/' },
];

console.log('TradeEmpire run-morning — start');
for (const step of STEPS) {
  const scriptPath = path.join(__dirname, step.script);
  console.log('Running', step.script, '...');
  try {
    execSync(`node "${scriptPath}"`, { encoding: 'utf8', cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error(step.script, 'failed:', e.message);
    process.exit(1);
  }
  appendWire({
    from_agent: step.from,
    to_agent: step.to,
    type: 'SHARE_SIGNAL',
    context: { window: 'morning_brief' },
    content_summary: step.summary,
    content_ref: step.ref,
  });
  if (step.script === 'crypto-indicators-rapidapi.js' && chaseFeedbackLoader && chaseFeedbackLoader.hasRecentLosses()) {
    console.log('Chase (post-mortem loss) : lancement TradingView events (RapidAPI) pour renforcer signaux.');
    try {
      execSync('node "' + path.join(__dirname, 'tradingview-events-calendar.js') + '"', { encoding: 'utf8', cwd: ROOT, stdio: 'inherit' });
      appendWire({
        from_agent: 'TECHNICALS',
        to_agent: 'ORCHESTRATOR',
        type: 'SHARE_SIGNAL',
        context: { window: 'morning_brief', chase_adapt: true },
        content_summary: 'Calendrier événements TradingView (RapidAPI) — activé après loss Chase.',
        content_ref: 'data/signals/technicals/tradingview_events_calendar.json',
      });
    } catch (_) {}
  }
}
appendWire({
  from_agent: 'RISK_JOURNAL',
  to_agent: 'BOSS',
  type: 'SHARE_SIGNAL',
  context: { window: 'morning_brief' },
  content_summary: 'Décisions (APPROVED/REJECTED) et idées du jour — contexte pour BOSS.',
  content_ref: 'data/decisions/ et data/journal/',
});
console.log('TradeEmpire run-morning — done');
