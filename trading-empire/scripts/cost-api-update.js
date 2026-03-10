#!/usr/bin/env node
/**
 * Met à jour les coûts API (X, ClawRouter, OpenRouter) dans data/dashboard/costs.json.
 * - X (Twitter) : GET /2/usage/tweets → project_usage ; coût = project_usage × 0,005 $ (https://developer.x.com/#pricing). Override (pas d’API X pour le $).
 * - OpenRouter : GET https://openrouter.ai/api/v1/key → usage_usd, usage_monthly_usd (OPENROUTER_API_KEY).
 * - ClawRouter : manuel ou lecture wallet si disponible.
 *
 * Usage: node scripts/cost-api-update.js
 * Env: OPENROUTER_API_KEY, X_BEARER_TOKEN (pour l'Usage API X), X_COST_USD (optionnel).
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DASHBOARD = path.join(ROOT, 'data', 'dashboard');
const COSTS_PATH = path.join(DATA_DASHBOARD, 'costs.json');
const USAGE_X_PATH = path.join(DATA_DASHBOARD, 'usage_x.json');

function readJson(p, def = null) {
  if (!fs.existsSync(p)) return def;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return def;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Récupère l'usage Posts depuis l'API X (GET /2/usage/tweets).
 * Doc: https://docs.x.com/x-api/getting-started/pricing et https://docs.x.com/x-api/usage/get-usage
 */
async function fetchXUsage() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return null;
  return new Promise((resolve) => {
    const https = require('https');
    const url = 'https://api.x.com/2/usage/tweets?days=30';
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    }, (resp) => {
      let body = '';
      resp.on('data', (c) => { body += c; });
      resp.on('end', () => {
        if (resp.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          const j = JSON.parse(body);
          const data = j.data;
          if (!data) {
            resolve(null);
            return;
          }
          resolve({
            project_usage: data.project_usage,
            project_cap: data.project_cap,
            cap_reset_day: data.cap_reset_day,
            daily_project_usage: data.daily_project_usage,
          });
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

async function fetchOpenRouterUsage() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  return new Promise((resolve) => {
    const https = require('https');
    const req = https.get('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 10000,
    }, (resp) => {
      let body = '';
      resp.on('data', (c) => { body += c; });
      resp.on('end', () => {
        try {
          const j = JSON.parse(body);
          const d = j.data != null ? j.data : j;
          resolve({
            usage: d.usage,
            usage_monthly: d.usage_monthly,
            usage_daily: d.usage_daily,
            usage_weekly: d.usage_weekly,
            limit: d.limit,
            limit_remaining: d.limit_remaining,
          });
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

function aggregateXRequestsThisMonth() {
  const list = readJson(USAGE_X_PATH, []);
  if (!Array.isArray(list)) return null;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let total = 0;
  for (const e of list) {
    const t = e.ts ? new Date(e.ts) : null;
    if (!t || t.getUTCFullYear() !== y || t.getUTCMonth() !== m) continue;
    total += typeof e.requests === 'number' ? e.requests : 1;
  }
  return total;
}

async function main() {
  const costs = readJson(COSTS_PATH, { fixed_costs: [], api_costs: [], trading: {}, updated_at: null });
  if (!costs.api_costs || !Array.isArray(costs.api_costs)) {
    costs.api_costs = [];
  }
  const now = new Date().toISOString();

  // X (Twitter): Usage API officielle GET /2/usage/tweets + notre log local
  const xUsage = await fetchXUsage();
  const xRequests = aggregateXRequestsThisMonth();
  const xEntry = costs.api_costs.find((a) => a.id === 'x_twitter');
  if (xEntry) {
    xEntry.requests_this_month = xRequests;
    xEntry.last_updated = now;
    if (xUsage) {
      xEntry.x_project_usage = xUsage.project_usage;
      xEntry.x_project_cap = xUsage.project_cap;
      xEntry.x_cap_reset_day = xUsage.cap_reset_day;
      // Tarif officiel : 0,005 $ par lecture (Post) — https://developer.x.com/#pricing
      const xRatePerRead = 0.005;
      xEntry.cost = Math.round((xUsage.project_usage || 0) * xRatePerRead * 100) / 100;
    }
    const xCostEnv = process.env.X_COST_USD != null ? parseFloat(process.env.X_COST_USD) : NaN;
    if (!Number.isNaN(xCostEnv)) {
      xEntry.cost = xCostEnv;
    } else if (!xUsage && xEntry.subscription_monthly_usd != null) {
      xEntry.cost = xEntry.subscription_monthly_usd;
    }
  }

  // OpenRouter: fetch usage from API
  const openRouter = await fetchOpenRouterUsage();
  const orEntry = costs.api_costs.find((a) => a.id === 'openrouter');
  if (orEntry) {
    orEntry.last_updated = now;
    if (openRouter) {
      orEntry.usage_usd = openRouter.usage;
      orEntry.usage_monthly_usd = openRouter.usage_monthly;
      orEntry.cost = (openRouter.usage_monthly != null && openRouter.usage_monthly > 0)
        ? openRouter.usage_monthly
        : (openRouter.usage != null ? Math.round(openRouter.usage * 1000000) / 1000000 : null);
    }
  }

  // ClawRouter: no API, just touch last_updated so dashboard shows we ran
  const crEntry = costs.api_costs.find((a) => a.id === 'clawrouter');
  if (crEntry) {
    crEntry.last_updated = now;
  }

  // Gains (PnL réalisé ASTER) : récupération automatique pour la balance
  try {
    const aster = require('./aster-client.js');
    const realized = await aster.getRealizedPnlUsd();
    if (typeof realized === 'number' && !Number.isNaN(realized)) {
      if (!costs.trading) costs.trading = {};
      if (!costs.gains) costs.gains = {};
      costs.trading.realized_pnl_usd = realized;
      costs.gains.trading_realized_pnl_usd = realized;
      costs.gains_source = 'aster';
      console.log('  Gains (ASTER PnL réalisé) :', realized.toFixed(2), 'USD');
    }
  } catch (e) {
    // ASTER keys absentes ou API indisponible — on ne touche pas aux gains
    console.log('  Gains ASTER non récupérés :', (e && e.message) || 'clés ou API indisponible');
  }

  costs.updated_at = now;
  writeJson(COSTS_PATH, costs);
  console.log('Costs updated:', COSTS_PATH);
  if (xUsage) console.log('  X (Usage API): project_usage =', xUsage.project_usage, ', project_cap =', xUsage.project_cap);
  if (xRequests != null) console.log('  X: requests_this_month (local) =', xRequests);
  if (openRouter) console.log('  OpenRouter: usage_monthly_usd =', openRouter.usage_monthly, ', usage =', openRouter.usage);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
