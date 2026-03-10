#!/usr/bin/env node
/**
 * TradeEmpire — Récupère le solde du wallet Hyperliquid (perps + spot / compte unifié).
 * Utilise HYPERLIQUID_WALLET depuis workspace/.env.
 * Usage: node scripts/hyperliquid-balance.js
 */

require('./load-workspace-env.js');

const INFO_URL = 'https://api.hyperliquid.xyz/info';

async function postInfo(body) {
  const res = await fetch(INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const wallet = (process.env.HYPERLIQUID_WALLET || '').trim();
  if (!wallet) {
    console.log('HYPERLIQUID_WALLET manquant dans workspace/.env');
    process.exit(1);
  }
  try {
    const [perps, spot] = await Promise.all([
      postInfo({ type: 'clearinghouseState', user: wallet }),
      postInfo({ type: 'spotClearinghouseState', user: wallet }),
    ]);
    const margin = perps.marginSummary || perps.crossMarginSummary || perps;
    const perpsAccountValue = margin.accountValue != null ? parseFloat(margin.accountValue) : null;
    const withdrawable = perps.withdrawable != null ? parseFloat(perps.withdrawable) : null;
    let spotUsd = 0;
    const spotBalances = [];
    const spotList = spot.balances || (Array.isArray(spot) ? spot : []);
    for (const b of spotList) {
      const total = parseFloat(b.total || 0);
      const hold = parseFloat(b.hold || 0);
      if (total > 0 || hold > 0) {
        spotBalances.push({ coin: b.coin || '?', total, hold, available: total - hold });
        const c = (b.coin || '').toUpperCase();
        if (c === 'USDC' || c === 'USD' || c === 'USDT' || c.startsWith('USDT')) spotUsd += total;
      }
    }
    if (process.env.DEBUG_HL_BALANCE) {
      console.log('Perps:', JSON.stringify(perps, null, 2));
      console.log('Spot:', JSON.stringify(spot, null, 2));
    }
    console.log('Hyperliquid — Solde wallet');
    console.log('Perps — Account value (USD):', perpsAccountValue != null ? perpsAccountValue.toFixed(2) : '—');
    console.log('Perps — Withdrawable (USD):', withdrawable != null ? withdrawable.toFixed(2) : '—');
    if (spotBalances.length > 0) {
      console.log('Spot — Soldes:');
      for (const b of spotBalances) {
        console.log('  ', b.coin + ':', b.available.toFixed(4), '(total:', b.total.toFixed(4) + ', hold:', b.hold.toFixed(4) + ')');
      }
      if (spotUsd > 0) console.log('Spot — USDC/USDT (USD):', spotUsd.toFixed(2));
    }
    const totalPortfolio = (perpsAccountValue != null ? perpsAccountValue : 0) + spotUsd;
    if (totalPortfolio > 0) console.log('Portfolio value (total):', totalPortfolio.toFixed(2), 'USD');
    if (perps.assetPositions && perps.assetPositions.length > 0) {
      console.log('Positions perp:', perps.assetPositions.length);
    }
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

main();
