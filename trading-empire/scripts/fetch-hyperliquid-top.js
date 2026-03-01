#!/usr/bin/env node
/**
 * TradeEmpire — Récupère les top performers Hyperliquid (leading vaults) pour l’agent SMART_MONEY.
 * Usage: node fetch-hyperliquid-top.js
 * Sortie: écrit data/hyperliquid/leading_vaults_<timestamp>.json (et JSON sur stdout en succès).
 * Aucune clé API requise (endpoint public /info).
 * L’agent dédié (SMART_MONEY) utilise ce script pour vérifier les top traders / vaults HL — pas de vue dashboard.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HYPERLIQUID_DIR = path.join(ROOT, 'data', 'hyperliquid');
const INFO_URL = 'https://api.hyperliquid.xyz/info';

async function postInfo(body) {
  const res = await fetch(INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchTopVaults() {
  try {
    return await postInfo({ type: 'leadingVaults' });
  } catch (e) {
    if (e.message && e.message.includes('422')) {
      const summaries = await postInfo({ type: 'vaultSummaries' });
      return Array.isArray(summaries) ? summaries : [];
    }
    throw e;
  }
}

async function main() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const timestampUtc = now.toISOString();

  if (!fs.existsSync(HYPERLIQUID_DIR)) {
    fs.mkdirSync(HYPERLIQUID_DIR, { recursive: true });
  }

  const filepath = path.join(HYPERLIQUID_DIR, `leading_vaults_${timestamp}.json`);

  try {
    const raw = await fetchTopVaults();
    const leading_vaults = Array.isArray(raw) ? raw : [raw];
    const out = {
      timestamp_utc: timestampUtc,
      source: 'hyperliquid_info',
      leading_vaults,
    };
    fs.writeFileSync(filepath, JSON.stringify(out, null, 2), 'utf8');
    console.log(JSON.stringify({ ok: true, file: filepath, count: leading_vaults.length }));
  } catch (err) {
    const fallback = {
      timestamp_utc: timestampUtc,
      source: 'hyperliquid_info',
      error: err.message,
      leading_vaults: [],
    };
    fs.writeFileSync(filepath, JSON.stringify(fallback, null, 2), 'utf8');
    console.error(err.message);
    console.log(JSON.stringify({ ok: false, file: filepath, error: err.message }));
    process.exit(1);
  }
}

main();
