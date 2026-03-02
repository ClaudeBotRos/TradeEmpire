#!/usr/bin/env node
/**
 * TradeEmpire — Intel (Daphnée) : Calendrier économique traditionnel.
 * Sources (dans l’ordre) :
 * 1. JBlanked API (si JBLANKED_API_KEY dans .env) — calendrier Forex Factory / MQL5, gratuit 1 req/jour.
 * 2. investing.com : l’API historique (getCalendarFilteredData) renvoie 404 ; la page est protégée par Cloudflare → non utilisable.
 * 3. Fallback : dashboard/config/economic_calendar_events.json (saisie manuelle).
 * Sortie : data/dashboard/intel/economic_calendar.json.
 * Usage: node scripts/economic-calendar-scan.js
 */

require('./load-workspace-env.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INTEL_DIR = path.join(ROOT, 'data', 'dashboard', 'intel');
const CALENDAR_PATH = path.join(INTEL_DIR, 'economic_calendar.json');
const CONFIG_PATH = path.join(ROOT, 'dashboard', 'config', 'economic_calendar_events.json');

/**
 * Récupère le calendrier depuis JBlanked (Forex Factory).
 * Doc : https://www.jblanked.com/news/api/docs/calendar/
 * Format réponse : [{ Name, Currency, Date, Actual, Forecast, Previous, Impact, ... }]
 * Date format: "2024.02.08 15:30:00"
 */
async function fetchJBlankedCalendar() {
  const apiKey = (process.env.JBLANKED_API_KEY || '').trim();
  if (!apiKey) return null;
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://www.jblanked.com/news/api/forex-factory/calendar/range/?from=${from}&to=${to}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.results || data.events || []);
    return list.map((row) => {
      const dateStr = row.Date || row.date || '';
      const [dPart, tPart] = dateStr.split(' ');
      const date = dPart ? dPart.replace(/\./g, '-') : null;
      const timeUtc = tPart ? tPart.slice(0, 5) : null;
      const impact = (row.Impact || row.impact || 'medium').toString().toLowerCase();
      return {
        date,
        time_utc: timeUtc,
        country: row.Currency || row.currency || row.Country || null,
        event: row.Name || row.name || row.Event || '',
        importance: impact,
        forecast: row.Forecast != null ? String(row.Forecast) : (row.forecast != null ? String(row.forecast) : null),
        previous: row.Previous != null ? String(row.Previous) : (row.previous != null ? String(row.previous) : null),
        actual: row.Actual != null ? String(row.Actual) : (row.actual != null ? String(row.actual) : null),
        event_id: row.eventID || row.id || null,
      };
    });
  } catch (_) {
    return null;
  }
}

/**
 * Charge les événements depuis le fichier config (saisie manuelle).
 * Format attendu: { "events": [ { "date": "2026-03-06", "time_utc": "14:30", "country": "US", "event": "Non-Farm Payrolls", "importance": "high", "forecast": "200K", "previous": "195K" } ] }
 */
function loadConfigEvents() {
  if (!fs.existsSync(CONFIG_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const list = Array.isArray(raw.events) ? raw.events : [];
    return list.map((e) => ({
      date: e.date || null,
      time_utc: e.time_utc || e.time || null,
      country: e.country || e.currency || null,
      event: e.event || e.name || e.title || '',
      importance: (e.importance || e.impact || 'medium').toLowerCase(),
      forecast: e.forecast ?? null,
      previous: e.previous ?? null,
      actual: e.actual ?? null,
      event_id: e.event_id || e.id || null,
    }));
  } catch (_) {
    return [];
  }
}

/**
 * investing.com : l’API getCalendarFilteredData renvoie 404 ; la page HTML est protégée par Cloudflare.
 * Conservé pour référence uniquement (non utilisé en prod).
 */
async function fetchInvestingCalendar() {
  return null;
}

/**
 * Charge le calendrier existant pour fusionner les "actual" déjà connus.
 */
function loadExistingCalendar() {
  if (!fs.existsSync(CALENDAR_PATH)) return { events: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf8'));
    return { events: Array.isArray(raw.events) ? raw.events : [] };
  } catch (_) {
    return { events: [] };
  }
}

/**
 * Fusionne les actuals des événements existants dans la nouvelle liste (par event_id ou date+event).
 */
function mergeActuals(existingEvents, newEvents) {
  const byKey = (e) => (e.event_id || '') + '|' + (e.date || '') + '|' + (e.event || '');
  const map = new Map();
  for (const e of existingEvents) {
    if (e.actual != null && e.actual !== '') map.set(byKey(e), e.actual);
  }
  for (const e of newEvents) {
    const key = byKey(e);
    if (map.has(key) && (e.actual == null || e.actual === '')) e.actual = map.get(key);
  }
  return newEvents;
}

async function main() {
  const existing = loadExistingCalendar();
  let events = await fetchJBlankedCalendar();
  let source = 'jblanked';
  if (!events || !events.length) {
    events = await fetchInvestingCalendar();
    if (events && events.length) source = 'investing_com';
  }
  if (!events || !events.length) {
    events = loadConfigEvents();
    source = 'config';
  }
  events = mergeActuals(existing.events, events);
  const output = {
    last_updated_utc: new Date().toISOString(),
    source,
    events,
  };
  if (!fs.existsSync(INTEL_DIR)) fs.mkdirSync(INTEL_DIR, { recursive: true });
  fs.writeFileSync(CALENDAR_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('OK', CALENDAR_PATH, '| source:', source, '| events:', events.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
