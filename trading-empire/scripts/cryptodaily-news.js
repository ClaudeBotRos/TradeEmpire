#!/usr/bin/env node
/**
 * TradeEmpire — Intel (Daphnée) : actualités crypto du jour (CryptoDaily via RapidAPI).
 * GET https://cryptocurrency-news2.p.rapidapi.com/v1/cryptodaily
 * Utilise RAPIDAPI_KEY (workspace/.env).
 * Sortie: data/dashboard/intel/cryptodaily_news.json
 * Usage: node scripts/cryptodaily-news.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INTEL_DIR = path.join(ROOT, 'data', 'dashboard', 'intel');
const OUT_PATH = path.join(INTEL_DIR, 'cryptodaily_news.json');

const HOST = 'cryptocurrency-news2.p.rapidapi.com';

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.news)) return data.news;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.articles)) return data.articles;
  if (data && data.data && Array.isArray(data.data)) return data.data;
  if (data && data.result && Array.isArray(data.result)) return data.result;
  return [];
}

async function main() {
  const apiKey = (process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '').trim();
  if (!apiKey) {
    console.error('RAPIDAPI_KEY (ou X_RAPIDAPI_KEY) manquant dans .env');
    process.exit(1);
  }

  const url = `https://${HOST}/v1/cryptodaily`;
  let items = [];
  let error = null;
  let httpStatus = null;

  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'x-rapidapi-host': HOST,
      },
    });
    httpStatus = res.status;
    const text = await res.text();
    if (!res.ok) {
      error = `HTTP ${res.status}: ${text.slice(0, 150)}`;
      console.error('CryptoDaily', error);
    } else {
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        error = 'Réponse non-JSON';
        console.error('CryptoDaily: réponse non-JSON');
      }
      if (data && !error) {
        items = normalizeItems(data);
        items = items.slice(0, 50).map((it) => ({
          title: it.title || it.headline || it.name || it.text || '',
          url: it.url || it.link || it.source_url || null,
          date: it.date || it.publishedAt || it.published_at || it.time || null,
          source: it.source || it.provider || null,
          summary: it.summary || it.description || it.snippet || null,
        })).filter((it) => it.title || it.url);
      }
    }
  } catch (e) {
    error = (e.message || String(e)).slice(0, 200);
    console.error('CryptoDaily', error);
  }

  if (!fs.existsSync(INTEL_DIR)) fs.mkdirSync(INTEL_DIR, { recursive: true });

  const payload = {
    last_updated_utc: new Date().toISOString(),
    source: HOST,
    endpoint: 'v1/cryptodaily',
    http_status: httpStatus,
    error: error || undefined,
    items,
    count: items.length,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log('OK', OUT_PATH, '|', items.length, 'item(s)', error ? '| ' + error : '');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
