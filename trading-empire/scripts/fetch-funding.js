#!/usr/bin/env node
/**
 * TradeEmpire — Récupère le funding rate (et mark price) depuis Binance USDT-M Futures (API publique).
 * Usage: node fetch-funding.js SYMBOL
 * Default: BTCUSDT
 * Sortie: JSON sur stdout { fundingRate, markPrice, nextFundingTime, symbol }.
 */

const symbol = process.argv[2] || 'BTCUSDT';
const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;

async function fetchFunding() {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Binance API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return {
    symbol: data.symbol,
    fundingRate: parseFloat(data.lastFundingRate || 0),
    markPrice: parseFloat(data.markPrice || 0),
    nextFundingTime: data.nextFundingTime ? parseInt(data.nextFundingTime, 10) : null,
  };
}

fetchFunding()
  .then((out) => {
    console.log(JSON.stringify(out));
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
