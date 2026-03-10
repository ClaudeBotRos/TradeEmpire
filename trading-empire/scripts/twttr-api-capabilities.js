#!/usr/bin/env node
/**
 * Rapport des capacités de l'API Twttr (RapidAPI) pour rationaliser les coûts X.com.
 * Teste les endpoints connus et affiche ce qu'on peut récupérer → voir docs/RATIONNALISATION_COUTS_X_TWITTER.md
 *
 * Usage: node scripts/twttr-api-capabilities.js
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
      timeout: 20000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve({ status: res.statusCode, data: j, raw: body });
        } catch (_) {
          resolve({ status: res.statusCode, raw: body.slice(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/** Extrait les tweets/commentaires du format Timeline (result.instructions[].entries). */
function parseTimelineEntries(data) {
  const out = [];
  if (!data || !data.result || !Array.isArray(data.result.instructions)) return out;
  for (const inst of data.result.instructions) {
    if (inst.entries && Array.isArray(inst.entries)) {
      for (const entry of inst.entries) {
        const c = entry.content;
        if (!c) continue;
        if (c.entryType === 'TimelineTimelineItem' && c.itemContent && c.itemContent.tweet_results) {
          const t = c.itemContent.tweet_results.result;
          if (t && t.legacy) {
            const user = t.core?.user_results?.result;
            const legacyUser = user?.legacy || user?.core?.legacy;
            out.push({
              id: t.rest_id || t.legacy.id_str,
              text: t.legacy.full_text,
              screen_name: legacyUser?.screen_name ?? user?.screen_name,
              created_at: t.legacy.created_at,
            });
          }
        }
        if (c.entryType === 'TimelineTimelineModule' && c.items && Array.isArray(c.items)) {
          for (const it of c.items) {
            const itemContent = it.item?.itemContent;
            if (itemContent && itemContent.tweet_results) {
              const t = itemContent.tweet_results.result;
              if (t && t.legacy) {
                const user = t.core?.user_results?.result;
                const legacyUser = user?.legacy || user?.core?.legacy;
                out.push({
                  id: t.rest_id || t.legacy.id_str,
                  text: t.legacy.full_text,
                  screen_name: legacyUser?.screen_name ?? user?.screen_name,
                  created_at: t.legacy.created_at,
                });
              }
            }
          }
        }
      }
    }
  }
  return out;
}

async function main() {
  if (!API_KEY) {
    console.error('RAPIDAPI_KEY (ou X_RAPIDAPI_KEY) manquant dans .env');
    process.exit(1);
  }

  const report = {
    comments_v2: { ok: false, count: 0, cursor: false, sample: null },
    search: { ok: false, endpoint: null, note: 'Aucun endpoint search vérifié.' },
  };

  console.log('=== Capacités API Twttr (twitter241.p.rapidapi.com) ===\n');

  // ---- 1) Comments V2 (vérifié)
  const pid = '1924185704613208381';
  console.log('1) GET /comments-v2 (réponses à un post)');
  try {
    const r = await request('/comments-v2', { pid, rankingMode: 'Relevance', count: '20' });
    if (r.status === 200 && r.data) {
      report.comments_v2.ok = true;
      report.comments_v2.cursor = !!(r.data.cursor && r.data.cursor.bottom);
      const tweets = parseTimelineEntries(r.data);
      report.comments_v2.count = tweets.length;
      if (tweets.length) {
        report.comments_v2.sample = { id: tweets[0].id, text: (tweets[0].text || '').slice(0, 60), screen_name: tweets[0].screen_name };
      }
      console.log('   OK — Status 200');
      console.log('   Commentaires extraits:', tweets.length);
      console.log('   Pagination (cursor):', report.comments_v2.cursor ? 'oui' : 'non');
      if (tweets.length) console.log('   Exemple:', tweets[0].screen_name, '—', (tweets[0].text || '').slice(0, 50) + '...');
    } else {
      console.log('   Échec — Status', r.status, r.data ? Object.keys(r.data) : r.raw?.slice(0, 80));
    }
  } catch (e) {
    console.log('   Erreur:', e.message);
  }

  // ---- 2) Search (équivalent X search/recent) — essai des noms courants
  console.log('\n2) Search par mot-clé (équivalent X tweets/search/recent)');
  const searchCandidates = [
    ['/search', { q: 'crypto bitcoin', count: '10' }],
    ['/search-v2', { query: 'crypto', count: '10' }],
    ['/feed', { q: 'crypto', count: '10' }],
    ['/tweets/search', { query: 'crypto', count: '10' }],
    ['/v2/search', { q: 'crypto', max_results: '10' }],
  ];
  for (const [path, params] of searchCandidates) {
    try {
      const r = await request(path, params);
      if (r.status === 200 && r.data) {
        const hasTweets = r.data.data?.length || r.data.result?.length || r.data.tweets?.length;
        const hasTimeline = r.data.result?.instructions?.some((i) => i.entries?.length);
        if (hasTweets || hasTimeline) {
          report.search.ok = true;
          report.search.endpoint = path;
          report.search.note = 'Endpoint répond avec des tweets.';
          console.log('   OK', path, '→ données trouvées');
          break;
        }
        if (r.status === 200 && typeof r.data === 'object') {
          console.log('   ', path, '→ 200 mais format sans tweets (clés:', Object.keys(r.data).join(', ') + ')');
        }
      } else if (r.status !== 404) {
        console.log('   ', path, '→', r.status);
      }
    } catch (_) {}
  }
  if (!report.search.ok) {
    console.log('   Aucun endpoint search utilisable trouvé.');
    console.log('   → Consulter la fiche RapidAPI (twitter241) pour le nom exact du search.');
  }

  // ---- Rapport final pour rationalisation
  console.log('\n--- Rapport : ce qu\'on peut récupérer via Twttr ---');
  console.log('| Besoin TradeEmpire     | Twttr disponible ? | Remplace X ? |');
  console.log('|------------------------|--------------------|--------------|');
  console.log('| Réponses à un post     |', report.comments_v2.ok ? 'Oui (/comments-v2)' : 'Non', '|', report.comments_v2.ok ? 'Oui (si on utilise replies)' : '—', '|');
  console.log('| Search par mot-clé     |', report.search.ok ? 'Oui (' + report.search.endpoint + ')' : 'Non', '|', report.search.ok ? 'Oui (intel + sentiment)' : 'Non — garder X |');
  console.log('');
  console.log('Conclusion :');
  if (report.search.ok) {
    console.log('- On peut basculer intel-scan, sentiment-scan et agent-status sur Twttr pour réduire le coût X.');
  } else {
    console.log('- Search par mot-clé non disponible via Twttr avec les endpoints testés.');
    console.log('- Pour réduire le coût X : réduire max_results ou fréquence des crons (voir docs/RATIONNALISATION_COUTS_X_TWITTER.md).');
  }
  if (report.comments_v2.ok) {
    console.log('- Comments-v2 utilisable pour tout besoin "réponses à un tweet" sans consommer de reads X.');
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
