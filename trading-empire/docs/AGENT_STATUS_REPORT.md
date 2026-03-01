# Rapport de situation — Agents

Chaque agent teste ses **compétences** (exécution de son script), ses **connexions API** et produit un **rapport de situation** consolidé.

## Lancement

Depuis `trading-empire/` :

```bash
# Rapport complet : teste les APIs puis exécute le script de chaque agent (génère des données)
node scripts/agent-status-report.js

# Mode light : teste uniquement les APIs et l’accès aux fichiers (pas d’exécution des scripts)
node scripts/agent-status-report.js --light
```

Depuis la racine du workspace :

```bash
node TradeEmpire/trading-empire/scripts/agent-status-report.js
node TradeEmpire/trading-empire/scripts/agent-status-report.js --light
```

## Sorties

- **JSON** : `data/dashboard/agent_status_report.json` — utilisé par le dashboard (vue « Rapport agents »).
- **Markdown** : `data/reports/YYYY-MM-DD_agent_status.md` — rapport lisible par date.

## Contenu par agent

| Agent | Connexions API testées | Compétence testée |
|-------|------------------------|-------------------|
| **TECHNICALS** | Binance (klines) | technicals-scan.js |
| **SMART_MONEY** | Binance Futures (funding), Hyperliquid (vaultSummaries) | smart-money-scan.js |
| **SENTIMENT_X** | Twitter/X API v2 (X_BEARER_TOKEN) | sentiment-scan.js |
| **ORCHESTRATOR** | Fichiers locaux (signaux, idées) | orchestrator-scan.js |
| **RISK_JOURNAL** | Fichiers locaux (idées, risk_rules.md) | risk-journal-scan.js |
| **BOSS** | Dashboard (lecture/écriture spec, config) | boss-night.js |

Statuts : **ok** (tout vert), **warning** (APIs OK mais script non exécuté en --light, ou API optionnelle KO), **error** (échec API ou script).

## Dashboard

La vue **Rapport agents** (sidebar → Données) affiche le dernier rapport (timestamp, statut par agent, détail APIs et compétences). Rafraîchir la page après avoir exécuté le script.

## Cron (optionnel)

Pour un rapport quotidien (ex. 07:00), ajouter un job dans `cron/jobs.json` qui exécute `agent-status-report.js --light` et optionnellement envoie un résumé (ex. nombre d’agents en ok/warning/error) sur le canal de notification.
