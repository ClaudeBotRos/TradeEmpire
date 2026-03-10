# Agents OpenClaw — tous réels

**Doc de référence globale (chemins, daemon, cron, yield)** : `docs/DOC_REFERENCE_COMPLETE.md`.

Tous les rôles TradeEmpire sont désormais de **vrais agents OpenClaw**. Prénoms affichés au dashboard : BOSS, Lucy, Melissa, Lucas, Alicia, Pierre-Jaque, Chase, Tibo, Daphnée, **Clarissa** (Scout), **Killian** (Recovery), **Gary** (Yield), **Eva** (Hyperliquid). : chacun a un `agentId`, un modèle (primary + fallbacks), un dossier sous `~/.openclaw/agents/<id>/`, et les crons utilisent ce `agentId` pour que ce soit **son** soul et **son** modèle qui tournent.

## Liste des agents

| agentId | Rôle | Modèle (primary + fallbacks) |
|--------|------|------------------------------|
| main | Par défaut, tâches système (agent-report, whatsapp-pending, boss-night-fallback) | config par défaut |
| boss | BOSS vision (10h), BOSS nuit (01h) | ollama/qwen3.5 + openrouter/llama + blockrun |
| tibo | Executor (08:25, 12:08, 15:08), Scrutateur TP (toutes les 15 min) | ollama/qwen3.5 + openrouter + blockrun |
| orchestrator | Cleanup (07:50), Séquence matin + brief (08:15) | ollama/qwen3.5 + openrouter + blockrun |
| risk_journal | Soir (20:30) journal + récap | ollama/qwen3.5 + openrouter + blockrun |
| intel | Intel / Trend Cards (09:00) | ollama/qwen3.5 + openrouter + blockrun |
| opportunity_scout | Clarissa — Scout (09:20, 12:25, 15:25, 17:55), Scout validation status | ollama/qwen3.5 + openrouter + blockrun |
| recovery_analyst | Killian — Recovery report, Recovery intraday (12:30, 15:30, 18:00) | ollama/qwen3.5 + openrouter + blockrun |
| chase | Chase tracker | ollama/qwen3.5 + openrouter + blockrun |
| technicals | Scan technique (job désactivé, remplacé par matin) | ollama/qwen3.5 + openrouter + blockrun |
| sentiment_x | (réservé) | ollama/qwen3.5 + openrouter + blockrun |
| smart_money | (réservé) | ollama/qwen3.5 + openrouter + blockrun |
| yield_farmer | Gary — Yield farming Uniswap V3 (Arbitrum), rapports et pools | ollama/qwen3.5 + openrouter + blockrun |
| hyperliquid_analyst | Eva — Actifs tokenisés HL (or, pétrole, matières premières), tendances et recommandations | ollama/qwen3.5 + openrouter + blockrun |

## Contexte partagé

Tous les agents utilisent le **même workspace** : `~/.openclaw/workspace`. Les chemins `workspace-boss`, `workspace-tibo`, `workspace-orchestrator`, etc. sont des **symlinks** vers `workspace`. Aucune recopie : un seul arbre de fichiers partagé.

## Chargement du rôle (soul / tasks)

Les crons indiquent à chaque agent de lire son soul et ses tasks avant d’agir, par exemple :  
« Tu es l’Orchestrator. Lis TradeEmpire/trading-empire/agents/orchestrator/soul.md et tasks.md puis … »  
Les fichiers sont dans `workspace/TradeEmpire/trading-empire/agents/<role>/`.

## Vérification et test en conditions réelles

1. **Audit complet des scripts** (sans passer par le LLM) :  
   `cd ~/.openclaw/workspace && node TradeEmpire/trading-empire/scripts/cron-full-audit.js`  
   Rapport dans `TradeEmpire/trading-empire/data/reports/CRON_FULL_AUDIT_YYYY-MM-DD.md`.

2. **Test d’un cron avec le bon agent** :  
   `openclaw cron run <job-id>`  
   Vérifier dans les logs ou le résumé que le bon agent (et donc le bon modèle) a répondu, et que le statut est `ok` sans timeout.

3. **Vérifier les symlinks** :  
   `ls -la ~/.openclaw/workspace-*`  
   Tous doivent pointer vers `workspace` (sauf `workspace` lui-même).

4. **Vérifier la liste des agents** :  
   `openclaw.json` → `agents.list` doit contenir tous les `agentId` ci-dessus.
