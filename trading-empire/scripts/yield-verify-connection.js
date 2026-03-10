#!/usr/bin/env node
/**
 * TradeEmpire — Vérifie la connexion à l'API Uniswap Labs (clé créée sur https://developers.uniswap.org/dashboard/).
 * Utilise l'endpoint Liquidity Provisioning (ex. POST /lp/approve) avec la clé x-api-key.
 * Doc: https://api-docs.uniswap.org/introduction
 * Usage: node scripts/yield-verify-connection.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'data', 'dashboard', 'yield_farmer_config.json');

const UNISWAP_LABS_API_BASE = 'https://trade-api.uniswap.org/v1';

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function postJson(hostname, pathname, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      'x-api-key': apiKey,
    };
    const req = https.request(
      {
        hostname,
        path: pathname,
        method: 'POST',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (ch) => (data += ch));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ statusCode: res.statusCode, data: parsed, raw: data });
          } catch (_) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const config = readJson(CONFIG_PATH) || {};
  const chain = config.chain || 'arbitrum';
  const chainId = config.chain_id || 42161;
  const apiKeyEnv = config.uniswap_api_key_env || config.the_graph_api_key_env || 'UNISWAP_API_KEY';
  const apiKey = process.env[apiKeyEnv] || process.env.THE_GRAPH_API_KEY_UNISWAP;

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    console.error('Erreur: variable d’environnement', apiKeyEnv, 'ou THE_GRAPH_API_KEY_UNISWAP non définie. Vérifier workspace/.env');
    process.exit(1);
  }

  const key = apiKey.trim();
  const u = new URL(UNISWAP_LABS_API_BASE);
  console.log('API Uniswap Labs:', UNISWAP_LABS_API_BASE);
  console.log('Chaîne:', chain, '| chainId:', chainId);
  console.log('Clé: variable', apiKeyEnv, 'ou THE_GRAPH_API_KEY_UNISWAP (créée sur https://developers.uniswap.org/dashboard/)');

  const walletAddress = config.wallet_address || '0x6B5Fb55d58ca32c900957d8cbdF6CdC056d64947';
  const usdcArbitrum = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  const usdtArbitrum = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';

  const lpBody = {
    protocol: 'V3',
    chainId,
    walletAddress,
    token0: usdcArbitrum,
    token1: usdtArbitrum,
  };
  const quoteBody = {
    tokenIn: usdcArbitrum,
    tokenOut: usdtArbitrum,
    tokenInChainId: chainId,
    tokenOutChainId: chainId,
    type: 'EXACT_INPUT',
    amount: '1000000',
    swapper: walletAddress,
    slippageTolerance: 0.5,
  };

  const bases = [
    { name: 'production', url: 'https://trade-api.uniswap.org/v1' },
    { name: 'gateway', url: 'https://trade-api.gateway.uniswap.org/v1' },
  ];

  try {
    let statusCode, data, raw;
    for (const base of bases) {
      const bu = new URL(base.url);
      const res = await postJson(bu.hostname, bu.pathname + '/lp/approve', lpBody, key);
      console.log('LP approve @', base.name, ':', res.statusCode);
      if (res.statusCode === 200) {
        statusCode = 200;
        data = res.data;
        raw = res.raw;
        console.log('Connexion OK (LP). Base URL a utiliser:', base.url);
        if (data && data.requestId) console.log('Request ID:', data.requestId);
        console.log('Resume: on peut utiliser les endpoints /lp/* avec cette base.');
        return;
      }
      if (res.statusCode !== 403) {
        statusCode = res.statusCode;
        data = res.data;
        raw = res.raw;
        break;
      }
    }
    statusCode = statusCode ?? 403;
    data = data ?? {};
    raw = raw ?? '';

    if (statusCode === 403) {
      const createBody = {
        protocol: 'V3',
        chainId,
        walletAddress,
        position: {
          pool: {
            token0: usdcArbitrum,
            token1: usdtArbitrum,
            fee: 500,
          },
          tickLower: -887220,
          tickUpper: 887220,
        },
        poolLiquidity: '1000000000000',
        currentTick: 0,
        sqrtRatioX96: '79228162514264337593543950336',
        amount0: '1000000',
        amount1: '1000000',
        slippageTolerance: 0.5,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        simulateTransaction: true,
      };
      const createRes = await postJson(u.hostname, u.pathname + '/lp/create', createBody, key);
      console.log('LP create @ production :', createRes.statusCode);
      if (createRes.statusCode === 200) {
        console.log('Connexion OK (LP create). La cle a acces aux endpoints LP.');
        if (createRes.data && createRes.data.requestId) console.log('Request ID:', createRes.data.requestId);
        return;
      }
      if (createRes.statusCode === 403) {
        console.log('LP create : 403 aussi (acces LP non active pour cette cle).');
      }

      const q = await postJson(u.hostname, u.pathname + '/quote', quoteBody, key);
      statusCode = q.statusCode;
      data = q.data;
      raw = q.raw;
      if (statusCode === 200) {
        console.log('Connexion OK. API Uniswap Labs repond (/quote). (LP peut necessiter un plan specifique.)');
        if (data && data.requestId) console.log('Request ID:', data.requestId);
        console.log('Resume: la cle Uniswap est valide ; on se connecte bien a l\'API Uniswap Labs.');
        return;
      }
    }

    if (statusCode === 401) {
      console.error('Erreur 401 Unauthorized: clé API invalide ou expirée.');
      console.error('Vérifier que la clé a été créée sur https://developers.uniswap.org/dashboard/ et qu’elle est bien dans workspace/.env (THE_GRAPH_API_KEY_UNISWAP ou UNISWAP_API_KEY).');
      process.exit(1);
    }

    if (statusCode === 429) {
      console.error('Erreur 429: rate limit (3 req/s par clé). Réessayer plus tard.');
      process.exit(1);
    }

    if (statusCode !== 200) {
      console.error('Réponse', statusCode, ':', (data && data.detail) || (data && data.errorCode) || (data && data.message) || raw?.slice(0, 300));
      if (statusCode === 403) console.error('Conseil: 403 peut indiquer que la cle n\'a pas acces a cet endpoint. Verifier le plan sur developers.uniswap.org/dashboard.');
      process.exit(1);
    }

    console.log('Connexion OK. API Uniswap Labs répond (LP approve).');
    if (data && data.requestId) console.log('Request ID:', data.requestId);
    console.log('Résumé: on se connecte bien à l’API Uniswap Labs (Liquidity Provisioning) avec ta clé.');
  } catch (e) {
    console.error('Échec connexion:', e.message || e);
    process.exit(1);
  }
}

main();
