/**
 * Charge les limites X (max_results) pour intel (Daphnée), sentiment et agent-status.
 * Fichier : dashboard/config/intel_x_limits.json — peut être édité par BOSS selon la balance.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'dashboard', 'config', 'intel_x_limits.json');

const DEFAULTS = {
  x_max_results_intel: 50,
  x_max_results_sentiment: 20,
  x_max_results_agent_status: 10,
};

function loadIntelXLimits() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return {
        x_max_results_intel: Math.min(100, Math.max(5, parseInt(raw.x_max_results_intel, 10) || DEFAULTS.x_max_results_intel)),
        x_max_results_sentiment: Math.min(50, Math.max(5, parseInt(raw.x_max_results_sentiment, 10) || DEFAULTS.x_max_results_sentiment)),
        x_max_results_agent_status: Math.min(20, Math.max(5, parseInt(raw.x_max_results_agent_status, 10) || DEFAULTS.x_max_results_agent_status)),
      };
    }
  } catch (_) {}
  return { ...DEFAULTS };
}

module.exports = { loadIntelXLimits, CONFIG_PATH, DEFAULTS };
