#!/usr/bin/env node
/**
 * Cache des requêtes X (Twitter) pour réduire les appels GET répétitifs.
 * TTL par défaut 1h ; même clé dans la même fenêtre = cache hit.
 * Utilisé par intel-scan.js et sentiment-scan.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'dashboard', 'intel');
const CACHE_FILE = path.join(CACHE_DIR, 'x_posts_cache.json');
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 100;

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveCache(obj) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 0), 'utf8');
}

/**
 * Retourne les données en cache si valides, sinon appelle fetchFn(), met en cache et retourne.
 * @param {string} key - Clé (ex: "x_posts_2026-03-10T08" pour heure, ou "x_posts_2026-03-10" pour jour).
 * @param {number} ttlMs - TTL en ms (défaut 1h).
 * @param {() => Promise<{data?: any, error?: string}>} fetchFn - Fonction async qui fait l’appel API.
 * @returns {Promise<{data?: any, error?: string}>}
 */
async function getCachedOrFetch(key, ttlMs, fetchFn) {
  const cache = loadCache();
  const now = Date.now();
  const entry = cache[key];
  if (entry && entry.fetched_at && (now - entry.fetched_at) < ttlMs && entry.data != null) {
    return { data: entry.data, error: null, fromCache: true };
  }
  const result = await fetchFn();
  if (result.data != null) {
    cache[key] = { data: result.data, fetched_at: now };
    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) {
      const sorted = keys.map((k) => ({ k, t: cache[k].fetched_at })).sort((a, b) => a.t - b.t);
      for (let i = 0; i < sorted.length - MAX_ENTRIES; i++) delete cache[sorted[i].k];
    }
    saveCache(cache);
  }
  return { ...result, fromCache: false };
}

/**
 * Clé horaire pour partager le cache entre intel et sentiment sur la même heure.
 * @returns {string} "x_posts_YYYY-MM-DDTHH"
 */
function hourlyKey() {
  return 'x_posts_' + new Date().toISOString().slice(0, 13);
}

let _logXUsage;
function getLogXUsage() {
  if (!_logXUsage) {
    try { _logXUsage = require('./log-x-usage.js').logXUsage; } catch (_) { _logXUsage = () => {}; }
  }
  return _logXUsage;
}

/**
 * Appel X API canonique (une requête partagée intel + sentiment pour réduire ~30% d’appels).
 * Utilise la même query et le même cache pour les deux.
 */
async function fetchXCanonical() {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return { data: null, error: 'X_BEARER_TOKEN non défini' };
  let limits = { x_max_results_intel: 50 };
  try {
    const { loadIntelXLimits } = require('./load-intel-x-limits.js');
    limits = loadIntelXLimits();
  } catch (_) {}
  const maxResults = Math.min(100, limits.x_max_results_intel || 50);
  const query = encodeURIComponent('crypto OR bitcoin OR BTC OR ethereum -is:retweet lang:en');
  const startTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=${maxResults}&start_time=${encodeURIComponent(startTime)}&tweet.fields=created_at,text`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: `X API ${res.status}: ${(text || res.statusText).slice(0, 200)}` };
    }
    const data = await res.json();
    const tweetsCount = data.data?.length ?? 0;
    getLogXUsage()(1, tweetsCount);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: (e && e.message) ? e.message : 'Erreur réseau X' };
  }
}

/**
 * Retourne les posts X (crypto/bitcoin) depuis le cache ou l’API (1 appel partagé par heure pour intel + sentiment).
 * @returns {Promise<{data: object|null, error: string|null, fromCache?: boolean}>}
 */
async function getCachedXPosts() {
  return getCachedOrFetch(hourlyKey(), DEFAULT_TTL_MS, fetchXCanonical);
}

module.exports = { getCachedOrFetch, hourlyKey, DEFAULT_TTL_MS, getCachedXPosts, fetchXCanonical };
