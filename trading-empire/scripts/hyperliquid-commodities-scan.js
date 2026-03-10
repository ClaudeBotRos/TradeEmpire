#!/usr/bin/env node
/**
 * TradeEmpire — Scan des actifs tokenisés (or, pétrole, matières premières) sur Hyperliquid.
 * Inclut le main dex (meta) et tous les HIP-3 (allPerpMetas + perpDexs).
 * Écrit data/hyperliquid/commodities_meta.json et hip3_dexes.json pour l'agent Hyperliquid Analyst.
 * Usage: node scripts/hyperliquid-commodities-scan.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HYPERLIQUID_DIR = path.join(ROOT, 'data', 'hyperliquid');
const OUT_PATH = path.join(HYPERLIQUID_DIR, 'commodities_meta.json');
const HIP3_DEXES_PATH = path.join(HYPERLIQUID_DIR, 'hip3_dexes.json');
const INFO_URL = 'https://api.hyperliquid.xyz/info';

const COMMODITY_PATTERNS = [
  /^XAU$/i, /^GOLD/i, /^OIL/i, /^BRENT/i, /^WTI/i, /^CRUDE/i,
  /^SILVER$/i, /^AG$/i, /^COPPER$/i, /^PLAT/i, /^PALLADIUM/i,
  /^NATURAL.?GAS/i, /^GAS$/i, /^CORN/i, /^WHEAT/i, /^SOY/i,
  /^SUGAR/i, /^COFFEE/i, /^COTTON/i, /^COMMODITY/i,
  /:XAU$/i, /:GOLD/i, /:OIL/i, /:SILVER/i, /:TSLA/i, /:AAPL/i,
];

async function postInfo(body) {
  const res = await fetch(INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API ${res.status}: ${await res.text()}`);
  return res.json();
}

function isCommodityOrTokenized(name) {
  if (!name || typeof name !== 'string') return false;
  const u = name.toUpperCase();
  if (COMMODITY_PATTERNS.some((p) => p.test(u))) return true;
  if (u.includes(':')) return true;
  return false;
}

function extractUniverseFromMeta(meta) {
  if (Array.isArray(meta) && meta[0] && meta[0].universe) return meta[0].universe;
  if (meta && meta.universe) return meta.universe;
  if (Array.isArray(meta)) return meta;
  return [];
}

async function main() {
  const now = new Date().toISOString();
  if (!fs.existsSync(HYPERLIQUID_DIR)) fs.mkdirSync(HYPERLIQUID_DIR, { recursive: true });

  let perpDexs = [];
  let allPerpMetas = [];
  try {
    perpDexs = await postInfo({ type: 'perpDexs' });
    allPerpMetas = await postInfo({ type: 'allPerpMetas' });
  } catch (e) {
    const fallback = { timestamp_utc: now, source: 'hyperliquid_commodities_scan', error: e.message, hip3_dexes: [], commodities: [] };
    fs.writeFileSync(OUT_PATH, JSON.stringify(fallback, null, 2), 'utf8');
    console.error(e.message);
    process.exit(1);
  }

  const dexNames = Array.isArray(perpDexs) ? perpDexs : [];
  const dexList = dexNames.map((d, i) => (d && d.name ? { index: i, name: d.name, fullName: d.fullName || '' } : { index: i, name: i === 0 ? '(main)' : '', fullName: '' })).filter((d) => d.name);
  try {
    fs.writeFileSync(HIP3_DEXES_PATH, JSON.stringify({ timestamp_utc: now, perpDexs: dexNames, dexList }, null, 2), 'utf8');
  } catch (_) {}

  const commodities = [];
  const allMetas = Array.isArray(allPerpMetas) ? allPerpMetas : [];
  for (let dexIdx = 0; dexIdx < allMetas.length; dexIdx++) {
    const metaBlock = allMetas[dexIdx];
    const universe = extractUniverseFromMeta(metaBlock);
    const dexName = dexIdx === 0 ? '' : (dexNames[dexIdx] && dexNames[dexIdx].name ? dexNames[dexIdx].name : `dex_${dexIdx}`);
    for (let i = 0; i < universe.length; i++) {
      const asset = universe[i];
      const name = typeof asset === 'string' ? asset : (asset && (asset.name || asset.sz) || String(asset));
      if (!isCommodityOrTokenized(name)) continue;
      commodities.push({
        dexIndex: dexIdx,
        dexName: dexName || '(main)',
        index: i,
        name,
        maxLeverage: asset && asset.maxLeverage,
        onlyIsolated: asset && asset.onlyIsolated,
      });
    }
  }

  let assetCtxsMain = [];
  try {
    const combined = await postInfo({ type: 'metaAndAssetCtxs', dex: '' });
    if (Array.isArray(combined) && combined.length >= 2) assetCtxsMain = combined[1] || [];
  } catch (_) {}
  for (let i = 0; i < commodities.length; i++) {
    const c = commodities[i];
    if (c.dexIndex === 0 && assetCtxsMain[c.index]) {
      const ctx = assetCtxsMain[c.index];
      c.markPx = ctx.markPx;
      c.funding = ctx.funding;
      c.openInterest = ctx.openInterest;
      c.dayNtlVlm = ctx.dayNtlVlm;
    }
  }

  const out = {
    timestamp_utc: now,
    source: 'hyperliquid_commodities_scan',
    hip3_dexes_count: dexList.length,
    commodities_count: commodities.length,
    commodities,
    hip3_dexes_file: 'hip3_dexes.json',
    note: 'Actifs tokenisés (main + HIP-3 builder-deployed perps). Or, pétrole, matières premières, actions (TSLA, etc.). Consommé par l\'agent Hyperliquid Analyst.',
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log('OK —', OUT_PATH, '| HIP-3 DEXes:', dexList.length, '| commodities/tokenized:', commodities.length, commodities.map((c) => c.name).join(', ') || '(aucun)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
