#!/usr/bin/env node
/**
 * Test minimal de l'API Twttr (RapidAPI) — twitter241.p.rapidapi.com
 * Pour comparer avec l'API X officielle (search, comments).
 * Usage: node scripts/twttr-rapidapi-test.js
 * Env: RAPIDAPI_KEY (workspace/.env)
 */

require('./load-workspace-env.js');

const https = require('https');

const RAPIDAPI_HOST = 'twitter241.p.rapidapi.com';
const API_KEY = (process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY || '').trim();

function request(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = path + (qs ? '?' + qs : '');
  return new Promise((resolve, reject) => {
    const req = https.get('https://' + RAPIDAPI_HOST + url, {
      headers: {
        'X-RapidAPI-Key': API_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve({ status: res.statusCode, data: j });
        } catch (_) {
          resolve({ status: res.statusCode, raw: body.slice(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  if (!API_KEY) {
    console.error('RAPIDAPI_KEY (ou X_RAPIDAPI_KEY) manquant dans .env');
    process.exit(1);
  }

  console.log('Test Twttr API (twitter241.p.rapidapi.com)\n');

  // 1) Get Post Comments V2 (comme sur ta capture — pid = exemple)
  const pid = '1924185704613208381';
  console.log('1) GET /comments-v2?pid=' + pid + '&rankingMode=Relevance&count=5');
  try {
    const r1 = await request('/comments-v2', { pid, rankingMode: 'Relevance', count: '5' });
    console.log('   Status:', r1.status);
    if (r1.data && r1.data.result && Array.isArray(r1.data.result)) {
      console.log('   Comments:', r1.data.result.length);
      if (r1.data.result[0]) console.log('   Exemple:', JSON.stringify(r1.data.result[0]).slice(0, 120) + '...');
    } else if (r1.data && (r1.data.timeline || r1.data.replies || r1.data.comments)) {
      const arr = r1.data.timeline || r1.data.replies || r1.data.comments || [];
      console.log('   Réponses:', Array.isArray(arr) ? arr.length : 'n/a', Object.keys(r1.data));
    } else if (r1.data) {
      console.log('   Clés:', Object.keys(r1.data).join(', '));
      console.log('   Réponse (extrait):', JSON.stringify(r1.data).slice(0, 400));
    } else if (r1.raw) {
      console.log('   Raw:', r1.raw);
    }
  } catch (e) {
    console.log('   Erreur:', e.message);
  }

  // 2) Essai search (noms courants sur RapidAPI Twitter)
  console.log('\n2) Essai search (équivalent X search/recent)');
  const searchPaths = [
    ['/search', { q: 'crypto bitcoin', count: '10' }],
    ['/search-v2', { query: 'crypto', count: '10' }],
    ['/feed', { q: 'crypto', count: '10' }],
  ];
  for (const [path, params] of searchPaths) {
    try {
      const r = await request(path, params);
      if (r.status === 200 && r.data && (r.data.result || r.data.data || r.data.tweets)) {
        console.log('   OK', path, Object.keys(r.data));
        break;
      }
      if (r.status !== 404) console.log('   ', path, '→', r.status, r.data ? JSON.stringify(r.data).slice(0, 100) : r.raw);
    } catch (_) {}
  }

  console.log('\nFin test. Vérifier la fiche RapidAPI pour la liste exacte des endpoints (search, user tweets).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
