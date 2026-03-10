#!/usr/bin/env node
/**
 * TradeEmpire — Récupère les meilleurs pools Uniswap V3 sur Arbitrum (DeFiLlama).
 * Écrit data/dashboard/uniswap_v3_arbitrum_pools.json (top par TVL + top stables sans IL).
 * Usage: node scripts/yield-fetch-pools-arbitrum.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'dashboard', 'uniswap_v3_arbitrum_pools.json');
const DEFILLAMA_URL = 'https://yields.llama.fi/pools';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function main() {
  fetchJson(DEFILLAMA_URL)
    .then((body) => {
      const all = (body.data || []).filter(
        (p) => p.chain === 'Arbitrum' && p.project === 'uniswap-v3'
      );

      const byTvl = [...all].sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0));
      const topByTvl = byTvl.slice(0, 20).map((p) => ({
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
        ilRisk: p.ilRisk,
        stablecoin: p.stablecoin,
        pool: p.pool,
        poolMeta: p.poolMeta,
      }));

      const noIl = all.filter((p) => p.ilRisk === 'no');
      const topStablesNoIl = [...noIl].sort((a, b) => (b.apy || 0) - (a.apy || 0)).slice(0, 15).map((p) => ({
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        ilRisk: p.ilRisk,
        stablecoin: p.stablecoin,
        pool: p.pool,
      }));

      const stablecoinOnly = all.filter((p) => p.stablecoin === true);
      const topStablecoinPools = [...stablecoinOnly].sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0)).slice(0, 15).map((p) => ({
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        ilRisk: p.ilRisk,
        pool: p.pool,
      }));

      const report = {
        updated_at: new Date().toISOString(),
        source: 'defillama',
        chain: 'Arbitrum',
        protocol: 'uniswap-v3',
        top_by_tvl: topByTvl,
        top_stables_no_il: topStablesNoIl,
        top_stablecoin_pools: topStablecoinPools,
        total_pools: all.length,
      };

      fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
      fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8');
      console.log('OK —', OUT_PATH);
      console.log('Top 5 par TVL:', topByTvl.slice(0, 5).map((p) => `${p.symbol} TVL=$${(p.tvlUsd / 1e6).toFixed(2)}M APY=${(p.apy || 0).toFixed(2)}%`).join(' | '));
      console.log('Stables sans IL (top APY):', topStablesNoIl.slice(0, 5).map((p) => `${p.symbol} TVL=$${Math.round(p.tvlUsd)} APY=${(p.apy || 0).toFixed(2)}%`).join(' | '));
      console.log('Pools stablecoin (TVL):', topStablecoinPools.slice(0, 5).map((p) => `${p.symbol} TVL=$${Math.round(p.tvlUsd)} APY=${(p.apy || 0).toFixed(2)}%`).join(' | '));
    })
    .catch((err) => {
      console.error('Erreur:', err.message);
      process.exit(1);
    });
}

main();
