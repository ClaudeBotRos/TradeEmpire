#!/usr/bin/env node
/**
 * Charge les variables de workspace/.env et DTO/app/.env dans process.env (pour scripts TradeEmpire).
 * Ordre : workspace/.env puis DTO/app/.env (les clés ASTER dans DTO/app/.env écrasent si doublon).
 */

const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
      process.env[key] = val;
    }
  });
}

const workspaceRoot = path.join(__dirname, '..', '..', '..');
loadEnv(path.join(workspaceRoot, '.env'));
loadEnv(path.join(workspaceRoot, 'DTO', 'app', '.env'));
