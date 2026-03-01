# Test des agents TradeEmpire

Chaque agent est un script Node qui produit des fichiers dans `data/`. Le script de test lance un ou plusieurs agents et valide leurs sorties (fichiers les plus récents par date de modification). Un mode **intégration** (`--full`) exécute `run-morning.js` puis valide toutes les sorties et le Wire.

## Lancer les tests

Depuis `trading-empire/` ou depuis la racine du workspace :

```bash
# Tous les agents dans l’ordre (technicals → smart_money → sentiment → orchestrator → risk_journal)
node scripts/test-agents.js

# Test d’intégration : run-morning + validation des 5 agents + Wire (au moins 5 entrées morning_brief)
node scripts/test-agents.js --full

# Un seul agent
node scripts/test-agents.js technicals
node scripts/test-agents.js smart_money
node scripts/test-agents.js sentiment
node scripts/test-agents.js orchestrator
node scripts/test-agents.js risk_journal

# Plusieurs agents
node scripts/test-agents.js technicals sentiment
```

Depuis la racine du workspace :

```bash
node TradeEmpire/trading-empire/scripts/test-agents.js
node TradeEmpire/trading-empire/scripts/test-agents.js --full
```

## Ce qui est validé

Pour **technicals**, **smart_money** et **sentiment**, la validation porte sur le **fichier JSON le plus récent** (par date de modification) dans le dossier de sortie, pour s’assurer que c’est bien la sortie du run en cours.

| Agent | Script | Sorties attendues | Champs vérifiés |
|-------|--------|-------------------|-----------------|
| **technicals** | technicals-scan.js | `data/signals/technicals/*.json` | timestamp_utc, symbol, trend, levels, volatility (fichier le plus récent) |
| **smart_money** | smart-money-scan.js | `data/signals/smart_money/*.json` | timestamp_utc, symbol, signals (array) (fichier le plus récent) |
| **sentiment** | sentiment-scan.js | `data/signals/sentiment/*.json` | timestamp_utc, narratives ou signals (fichier le plus récent) |
| **orchestrator** | orchestrator-scan.js | `data/ideas/*.json` | trade_id, symbol, entry.price, invalid.price, targets (0 idée accepté si aucun signal technique) |
| **risk_journal** | risk-journal-scan.js | `data/journal/{date}.md`, `data/decisions/*.json` | Journal créé ; si idées PROPOSED, au moins une décision |
| **wire** (mode `--full` uniquement) | run-morning.js | `data/dashboard/agent_exchanges.json` | Au moins 5 entrées avec `context.window === 'morning_brief'`, et les 5 agents (TECHNICALS, SMART_MONEY, SENTIMENT_X, ORCHESTRATOR, RISK_JOURNAL) présents |

## Dépendances entre agents

- **Orchestrator** lit les signaux (technicals, smart_money, sentiment). Pour obtenir des idées, lancer d’abord les trois agents de signaux (ou `run-morning.js` avant).
- **Risk_journal** lit les idées en statut `PROPOSED`. Pour obtenir des décisions, lancer d’abord l’orchestrator (qui produit des idées PROPOSED).

Pour un test complet dans l’ordre, utiliser `node scripts/test-agents.js` sans argument.

## Interprétation

- **OK** : le script s’est exécuté sans erreur et les fichiers produits respectent le format attendu.
- **FAIL (exécution)** : le script a levé une exception (réseau, fichier manquant, etc.).
- **FAIL (validation)** : le script a tourné mais les sorties n’ont pas les champs requis ou sont vides alors qu’attendus.

En cas d’échec, vérifier les prérequis (réseau pour Binance/Twitter, `.env` avec `X_BEARER_TOKEN` pour sentiment, présence des dossiers `data/`).
