# Audit COMPLET des crons — 2026-03-08

Chaque job activé, chaque script exécuté en conditions réelles. Rapport par étape.

---

## Nettoyage décisions non exécutées (07:50) (`tradeempire-cleanup-unexecuted`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/cle...` | workspace | 0 | 35 ms | — | OK |

## Séquence matin + brief (08:15) (`tradeempire-morning`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/run...` | workspace | 0 | 51725 ms | OK (209 fichier(s)) | OK |
| 2 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/mor...` | workspace | 0 | 48 ms | — | OK |

## Tibo Executor (08:25) (`tradeempire-executor`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/bui...` | workspace | 0 | 37 ms | OK | OK |
| 2 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/exe...` | workspace | 0 | 471 ms | — | OK |

## Tibo Executor relance (12:08) (`tradeempire-executor-12h`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/bui...` | workspace | 0 | 37 ms | — | OK |
| 2 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/exe...` | workspace | 0 | 464 ms | — | OK |

## Tibo Executor relance (15:08) (`tradeempire-executor-15h`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/bui...` | workspace | 0 | 37 ms | — | OK |
| 2 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/exe...` | workspace | 0 | 863 ms | — | OK |

## Tibo Scrutateur TP (toutes les 15 min) (`tradeempire-tp-scrutator`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/run...` | workspace | 0 | 33 ms | — | OK |

## Soir (20:30) journal + récap (`tradeempire-evening`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/ris...` | workspace | 0 | 48 ms | — | OK |
| 2 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/eve...` | workspace | 0 | 50 ms | — | OK |

## BOSS tâche nocturne (01:00) (`tradeempire-boss-night`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/bos...` | workspace | 0 | 463 ms | OK | OK |

## Envoi brief BOSS WhatsApp (01:03) (`tradeempire-boss-night-whatsapp-fallback`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/bos...` | workspace | 0 | 34 ms | — | OK |

## Intel / Trend Cards (09:00) (`tradeempire-intel`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/int...` | workspace | 0 | 6891 ms | OK | OK |

## BOSS vision / expansion (10:00) (`tradeempire-boss-vision`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/bos...` | workspace | 0 | 451 ms | OK | OK |

## Rapport agents (09:40) (`tradeempire-agent-report`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/age...` | workspace | 0 | 28136 ms | OK | OK |

## Opportunity Scout (09:20) (`tradeempire-opportunity-scout`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/opp...` | workspace | 0 | 81 ms | OK | OK |

## Scout (12:25) (`tradeempire-opportunity-scout-1225`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/opp...` | workspace | 0 | 48 ms | — | OK |

## Scout (15:25) (`tradeempire-opportunity-scout-1525`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/opp...` | workspace | 0 | 48 ms | — | OK |

## Scout (17:55) (`tradeempire-opportunity-scout-1755`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/opp...` | workspace | 0 | 48 ms | — | OK |

## Statut validation Scout (09:35) (`tradeempire-scout-validation-status`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/sco...` | workspace | 0 | 37 ms | OK | OK |

## Envoi file WhatsApp (toutes les 15 min) (`tradeempire-whatsapp-pending`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/sen...` | workspace | 0 | 17569 ms | — | OK |

## Recovery Analyst (21:15) (`tradeempire-recovery-analyst`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/rec...` | workspace | 0 | 38 ms | OK | OK |

## Chase / Tracker (21:00) (`tradeempire-chase`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/cha...` | workspace | 0 | 3947 ms | OK | OK |

## Veille airdrops (09:50) (`8e5ac65a-7ff8-47c2-8b00-b378cb5da365`)

**Note:** Tâche agent uniquement (recherche + write AIRDROPS.md). Aucun script à exécuter.

| Étape | Résultat |
|-------|----------|
| (aucun script) | — |

## Watchguard (toutes les 15 min) (`openclaw-watchguard`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/scripts/openclaw-watchguard.js"` | workspace | 0 | 8224 ms | OK (JSON valide) | OK |

## Backup OpenClaw → Samba (03:00) (`openclaw-backup-nightly`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `bash "/home/rosito/.openclaw/workspace/scripts/backup-openclaw-nightly.sh"` | workspace | -1 | 300101 ms | — | FAIL |

**stderr/error:**
```
spawnSync /bin/sh ETIMEDOUT
```


## Évolution agent (dimanche 04:00) (`capability-evolver-weekly`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/skills/capability-evolver/index.js" --...` | workspace | 0 | 60 ms | — | OK |

## Consultation mails (06:00) (`email-todo-6`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/scripts/imap-todo.js" --for-review --s...` | workspace | 0 | 1795 ms | — | OK |

## Consultation mails (09:15) (`email-todo-9`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/scripts/imap-todo.js" --for-review --s...` | workspace | 0 | 1984 ms | — | OK |

## Consultation mails (12:00) (`email-todo-12`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/scripts/imap-todo.js" --for-review --s...` | workspace | 0 | 1792 ms | — | OK |

## Consultation mails (15:00) (`email-todo-15`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/scripts/imap-todo.js" --for-review --s...` | workspace | 0 | 2031 ms | — | OK |

## Consultation mails (18:12) (`email-todo-18`)

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/scripts/imap-todo.js" --for-review --s...` | workspace | 0 | 1780 ms | — | OK |

## Recovery intraday (crontab système, 12:30/15:30/18:00) (`recovery-intraday-standalone`)

**Note:** Sans --apply-cancel en audit. En prod le standalone exécute aussi l’agent puis --apply-cancel.

| # | Commande | CWD | Exit | Durée | Vérif | Résultat |
|---|----------|-----|------|-------|-------|----------|
| 1 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/tec...` | workspace | 0 | 6778 ms | — | OK |
| 2 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/rec...` | workspace | 0 | 389 ms | OK | OK |
| 3 | `node "/home/rosito/.openclaw/workspace/TradeEmpire/trading-empire/scripts/rec...` | workspace | 0 | 394 ms | — | OK |

---

## Synthèse

- **Étapes exécutées:** 36
- **OK:** 35
- **FAIL:** 1

Généré par `scripts/cron-full-audit.js` à 2026-03-08T20:58:35.443Z.