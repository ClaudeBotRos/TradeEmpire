# Audit crons — agent, exécution, résultats

Généré : 2026-03-08T21:08:07.675Z

## 1. Liste des crons (agent exécutant)

| Job ID | Agent | Nom | Activé | Schedule | Timeout (s) |
|--------|-------|-----|--------|----------|--------------|
| dto-orchestrator-30min | **main** | DTO — Grilles Aster (toutes les 15 min) | Non | 6,21,36,51 * * * * | 180 |
| tradeempire-technicals | **technicals** | TradeEmpire — Scan technique (08:15) [remplacé par tradeempire-morning] | Non | 15 8 * * * | 60 |
| tradeempire-cleanup-unexecuted | **orchestrator** | TradeEmpire — Nettoyage décisions non exécutées (07:50) | Oui | 50 7 * * * | 30 |
| tradeempire-morning | **orchestrator** | TradeEmpire — Séquence matin + brief (08:15) | Oui | 15 8 * * * | 150 |
| tradeempire-executor | **tibo** | TradeEmpire — Tibo Executor (08:25, si mode réel) | Oui | 25 8 * * * | 180 |
| tradeempire-executor-12h | **tibo** | TradeEmpire — Tibo Executor relance (12:08) | Oui | 8 12 * * * | 180 |
| tradeempire-executor-15h | **tibo** | TradeEmpire — Tibo Executor relance (15:08) | Oui | 8 15 * * * | 180 |
| tradeempire-tp-scrutator | **tibo** | TradeEmpire — Tibo Scrutateur TP (toutes les 15 min) | Oui | 10,25,40,55 * * * * | 120 |
| tradeempire-evening | **risk_journal** | TradeEmpire — Soir (20:30) journal + récap WhatsApp | Oui | 30 20 * * * | 90 |
| tradeempire-boss-night | **boss** | TradeEmpire — BOSS tâche nocturne (01:00) | Oui | 0 1 * * * | 300 |
| tradeempire-boss-night-whatsapp-fallback | **main** | TradeEmpire — Envoi brief BOSS vers WhatsApp (01:03) | Oui | 3 1 * * * | 30 |
| tradeempire-intel | **intel** | TradeEmpire — Intel / Trend Cards (09:00) | Oui | 0 9 * * * | 120 |
| tradeempire-boss-vision | **boss** | TradeEmpire — BOSS vision / expansion (10:00) | Oui | 0 10 * * * | 120 |
| tradeempire-agent-report | **main** | TradeEmpire — Rapport agents (barres Team, 09:40) | Oui | 40 9 * * * | 120 |
| tradeempire-opportunity-scout | **opportunity_scout** | TradeEmpire — Opportunity Scout (09:20) | Oui | 20 9 * * * | 90 |
| tradeempire-opportunity-scout-1225 | **opportunity_scout** | TradeEmpire — Scout (12:25, avant Recovery 12:30) | Oui | 25 12 * * * | 90 |
| tradeempire-opportunity-scout-1525 | **opportunity_scout** | TradeEmpire — Scout (15:25, avant Recovery 15:30) | Oui | 25 15 * * * | 90 |
| tradeempire-opportunity-scout-1755 | **opportunity_scout** | TradeEmpire — Scout (17:55, avant Recovery 18:00) | Oui | 55 17 * * * | 90 |
| tradeempire-scout-validation-status | **opportunity_scout** | TradeEmpire — Statut validation Scout (09:35) | Oui | 35 9 * * * | 30 |
| tradeempire-whatsapp-pending | **main** | TradeEmpire — Envoi file WhatsApp (toutes les 15 min) | Oui | 5,20,35,50 * * * * | 45 |
| tradeempire-recovery-analyst | **recovery_analyst** | TradeEmpire — Recovery Analyst (21:15) | Oui | 15 21 * * * | 60 |
| tradeempire-recovery-intraday-1230 | **recovery_analyst** | TradeEmpire — Recovery revue intraday (12:30) | Oui | 30 12 * * * | 180 |
| tradeempire-recovery-intraday-1530 | **recovery_analyst** | TradeEmpire — Recovery revue intraday (15:30) | Oui | 30 15 * * * | 180 |
| tradeempire-recovery-intraday-18h | **recovery_analyst** | TradeEmpire — Recovery revue intraday (18:00) | Oui | 0 18 * * * | 180 |
| tradeempire-chase | **chase** | TradeEmpire — Chase / Tracker (21:00) | Oui | 0 21 * * * | 60 |
| dto-morning-930 | **main** | DTO — Résumé Aster (9h30) | Non | 30 9 * * * | 120 |
| 8e5ac65a-7ff8-47c2-8b00-b378cb5da365 | **main** | Veille airdrops | Oui | 50 9 * * * | 120 |
| 81fef5c2-d103-4871-88e1-a3ce00b8d7ae | **main** | Crypto price tweet (10 h) | Non | 8 10 * * * | 120 |
| 302a0709-4a41-42ca-9b7a-4470d7838f8d | **main** | Crypto sentiment tweet (every 2 h) | Non | 5 */2 * * * | 180 |
| openclaw-watchguard | **main** | Watchguard OpenClaw (statut + connexions) | Oui | 1,16,31,46 * * * * | 120 |
| openclaw-backup-nightly | **main** | Backup OpenClaw → Samba (nuit, 3h) | Oui | 0 3 * * * | 600 |
| capability-evolver-weekly | **main** | Évolution agent (capability-evolver, hebdo) | Oui | 0 4 * * 0 | 180 |
| email-todo-6 | **main** | Consultation mails (6h) | Oui | 0 6 * * * | 240 |
| email-todo-9 | **main** | Consultation mails (9h) | Oui | 15 9 * * * | 240 |
| email-todo-12 | **main** | Consultation mails (12h) | Oui | 0 12 * * * | 240 |
| email-todo-15 | **main** | Consultation mails (15h) | Oui | 0 15 * * * | 240 |
| email-todo-18 | **main** | Consultation mails (18h) | Oui | 12 18 * * * | 240 |

## 2. Dernier run par job (statut, provider, modèle, résumé)

### dto-orchestrator-30min
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-04T20:51:00.033Z
- **Statut :** ok | **Provider :** blockrun | **Modèle :** free | **Durée :** 20s
- **Résumé :** Connection error.

### tradeempire-technicals
- **Agent attendu :** technicals
- **Dernier run :** aucun enregistrement.

### tradeempire-cleanup-unexecuted
- **Agent config (attendu) :** orchestrator
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T06:50:00.040Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 18s
- **Résumé :** -

### tradeempire-morning
- **Agent config (attendu) :** orchestrator
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T07:15:00.039Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 62s
- **Résumé :** TradeEmpire — Brief 2026-03-08  Idées : 7 | APPROVED : 5 | REJECTED : 2 Approuvées : ADAUSDT, AVAXUSDT, DOTUSDT, ETHUSDT, LINKUSDT Refusées : 2  Journal et détails : data/journal/ — Dashboard : signau

### tradeempire-executor
- **Agent config (attendu) :** tibo
- **Agent exécutant (dernier run) :** non disponible
- **Dernier run :** 2026-03-08T07:25:00.013Z
- **Statut :** error | **Provider :** - | **Modèle :** - | **Durée :** 60s
- **Résumé :** cron: job execution timed out

### tradeempire-executor-12h
- **Agent config (attendu) :** tibo
- **Agent exécutant (dernier run) :** non disponible
- **Dernier run :** 2026-03-08T11:08:00.019Z
- **Statut :** error | **Provider :** - | **Modèle :** - | **Durée :** 90s
- **Résumé :** cron: job execution timed out

### tradeempire-executor-15h
- **Agent config (attendu) :** tibo
- **Agent exécutant (dernier run) :** non disponible
- **Dernier run :** 2026-03-08T14:08:17.014Z
- **Statut :** error | **Provider :** - | **Modèle :** - | **Durée :** 90s
- **Résumé :** cron: job execution timed out

### tradeempire-tp-scrutator
- **Agent config (attendu) :** tibo
- **Agent exécutant (dernier run) :** non disponible
- **Dernier run :** 2026-03-08T20:26:27.891Z
- **Statut :** error | **Provider :** - | **Modèle :** - | **Durée :** 60s
- **Résumé :** cron: job execution timed out

### tradeempire-evening
- **Agent config (attendu) :** risk_journal
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T19:30:00.046Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 32s
- **Résumé :** -

### tradeempire-boss-night
- **Agent config (attendu) :** boss
- **Agent exécutant (dernier run) :** boss
- **Dernier run :** 2026-03-08T08:22:05.364Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** meta-llama/llama-3.3-70b-instruct | **Durée :** 140s
- **Résumé :** -

### tradeempire-boss-night-whatsapp-fallback
- **Agent attendu :** main
- **Dernier run :** aucun enregistrement.

### tradeempire-intel
- **Agent config (attendu) :** intel
- **Agent exécutant (dernier run) :** intel
- **Dernier run :** 2026-03-08T20:48:08.507Z
- **Statut :** error | **Provider :** openrouter | **Modèle :** deepseek/deepseek-r1-distill-qwen-32b:free | **Durée :** 55s
- **Résumé :** 404 No endpoints found for deepseek/deepseek-r1-distill-qwen-32b:free.

### tradeempire-boss-vision
- **Agent config (attendu) :** boss
- **Agent exécutant (dernier run) :** boss
- **Dernier run :** 2026-03-08T08:45:00.046Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** meta-llama/llama-3.3-70b-instruct | **Durée :** 51s
- **Résumé :** Résumé : Préconisations robot :  Envisager un passage d'ordres plus rapide par mise en commun des données du trade. Améliorer le modèle de sentiemnt pour mieux comprendre les ventes et achats sur les 

### tradeempire-agent-report
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T08:30:09.985Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 44s
- **Résumé :** -

### tradeempire-opportunity-scout
- **Agent config (attendu) :** opportunity_scout
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T08:20:00.046Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 10s
- **Résumé :** Scout OK — 7 propositions

### tradeempire-opportunity-scout-1225
- **Agent config (attendu) :** opportunity_scout
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T11:25:00.048Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 10s
- **Résumé :** Scout OK — 7 propositions

### tradeempire-opportunity-scout-1525
- **Agent config (attendu) :** opportunity_scout
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T14:25:00.034Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 16s
- **Résumé :** Scout OK — 7 propositions

### tradeempire-opportunity-scout-1755
- **Agent config (attendu) :** opportunity_scout
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T16:55:00.037Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 16s
- **Résumé :** -

### tradeempire-scout-validation-status
- **Agent config (attendu) :** opportunity_scout
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T08:22:00.048Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 8s
- **Résumé :** Scout validation : 0 exécuté, 0 approuvé, 7 proposés

### tradeempire-whatsapp-pending
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T21:05:00.042Z
- **Statut :** error | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 16s
- **Résumé :** Provider returned error

### tradeempire-recovery-analyst
- **Agent config (attendu) :** recovery_analyst
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T20:15:00.011Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 8s
- **Résumé :** Recovery OK — 14 outcomes agrégés

### tradeempire-recovery-intraday-1230
- **Agent config (attendu) :** recovery_analyst
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T11:30:00.047Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 23s
- **Résumé :** Intraday OK — 3 ordres ASTER, 0 annulés.

### tradeempire-recovery-intraday-1530
- **Agent config (attendu) :** recovery_analyst
- **Agent exécutant (dernier run) :** non disponible
- **Dernier run :** 2026-03-08T14:30:00.043Z
- **Statut :** error | **Provider :** - | **Modèle :** - | **Durée :** 120s
- **Résumé :** cron: job execution timed out

### tradeempire-recovery-intraday-18h
- **Agent config (attendu) :** recovery_analyst
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T17:00:00.048Z
- **Statut :** error | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 39s
- **Résumé :** Provider returned error

### tradeempire-chase
- **Agent config (attendu) :** chase
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T20:00:00.013Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 16s
- **Résumé :** Chase OK — 14 post‑mortems, 5 nouveaux diffusés, feedback écrit.

### dto-morning-930
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-01T08:30:00.021Z
- **Statut :** ok | **Provider :** blockrun | **Modèle :** free | **Durée :** 34s
- **Résumé :** Balance dispo : 2.92729158   PnL non réalisé : -0.22152648    Grilles actives : - AVAXUSDT : 1 ordre - APTUSDT : 5 ordres - BARDUSDT : 6 ordres - BTCUSDT : 2 ordres - ETHUSDT : 3 ordres    Positions o

### 8e5ac65a-7ff8-47c2-8b00-b378cb5da365
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T08:05:00.039Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 22s
- **Résumé :** -

### 81fef5c2-d103-4871-88e1-a3ce00b8d7ae
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-02-27T10:00:30.088Z
- **Statut :** ok | **Provider :** blockrun | **Modèle :** free | **Durée :** 52s
- **Résumé :** Erreur : le script `x-browser.js` n’a pas pu publier le tweet (échec du clic sur le bouton).

### 302a0709-4a41-42ca-9b7a-4470d7838f8d
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-02-28T08:03:36.078Z
- **Statut :** ok | **Provider :** blockrun | **Modèle :** free | **Durée :** 15s
- **Résumé :** ⚠️ API rate limit reached. Please try again later.

### openclaw-watchguard
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** non disponible
- **Dernier run :** 2026-03-08T20:13:15.541Z
- **Statut :** error | **Provider :** - | **Modèle :** - | **Durée :** 60s
- **Résumé :** cron: job execution timed out

### openclaw-backup-nightly
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** non disponible
- **Dernier run :** 2026-03-08T02:00:00.036Z
- **Statut :** error | **Provider :** - | **Modèle :** - | **Durée :** 300s
- **Résumé :** cron: job execution timed out

### capability-evolver-weekly
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T03:00:00.036Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 11s
- **Résumé :** -

### email-todo-6
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T05:00:00.044Z
- **Statut :** error | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 19s
- **Résumé :** ⚠️ 📖 Read: from emails-pending-review.md failed

### email-todo-9
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T08:15:28.560Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 14s
- **Résumé :** -

### email-todo-12
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T11:00:00.035Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 14s
- **Résumé :** -

### email-todo-15
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T14:00:00.043Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 62s
- **Résumé :** -

### email-todo-18
- **Agent config (attendu) :** main
- **Agent exécutant (dernier run) :** main
- **Dernier run :** 2026-03-08T17:12:00.044Z
- **Statut :** ok | **Provider :** openrouter | **Modèle :** openai/gpt-oss-120b:free | **Durée :** 29s
- **Résumé :** -

## Synthèse — statut dernier run (jobs avec enregistrement)

| Job ID | Agent | Statut | Résumé court |
|--------|-------|--------|--------------|
| dto-orchestrator-30min | main | ok | Connection error. |
| tradeempire-cleanup-unexecuted | orchestrator | ok | - |
| tradeempire-morning | orchestrator | ok | TradeEmpire — Brief 2026-03-08

Idées : 7   APPROVED : 5   R |
| tradeempire-executor | tibo | error | cron: job execution timed out |
| tradeempire-executor-12h | tibo | error | cron: job execution timed out |
| tradeempire-executor-15h | tibo | error | cron: job execution timed out |
| tradeempire-tp-scrutator | tibo | error | cron: job execution timed out |
| tradeempire-evening | risk_journal | ok | - |
| tradeempire-boss-night | boss | ok | - |
| tradeempire-intel | intel | error | 404 No endpoints found for deepseek/deepseek-r1-distill-qwen |
| tradeempire-boss-vision | boss | ok | Résumé :
Préconisations robot : 
Envisager un passage d'ordr |
| tradeempire-agent-report | main | ok | - |
| tradeempire-opportunity-scout | opportunity_scout | ok | Scout OK — 7 propositions |
| tradeempire-opportunity-scout-1225 | opportunity_scout | ok | Scout OK — 7 propositions |
| tradeempire-opportunity-scout-1525 | opportunity_scout | ok | Scout OK — 7 propositions |
| tradeempire-opportunity-scout-1755 | opportunity_scout | ok | - |
| tradeempire-scout-validation-status | opportunity_scout | ok | Scout validation : 0 exécuté, 0 approuvé, 7 proposés |
| tradeempire-whatsapp-pending | main | error | Provider returned error |
| tradeempire-recovery-analyst | recovery_analyst | ok | Recovery OK — 14 outcomes agrégés |
| tradeempire-recovery-intraday-1230 | recovery_analyst | ok | Intraday OK — 3 ordres ASTER, 0 annulés. |
| tradeempire-recovery-intraday-1530 | recovery_analyst | error | cron: job execution timed out |
| tradeempire-recovery-intraday-18h | recovery_analyst | error | Provider returned error |
| tradeempire-chase | chase | ok | Chase OK — 14 post‑mortems, 5 nouveaux diffusés, feedback éc |
| dto-morning-930 | main | ok | Balance dispo : 2.92729158  
PnL non réalisé : -0.22152648   |
| 8e5ac65a-7ff8-47c2-8b00-b378cb5da365 | main | ok | - |
| 81fef5c2-d103-4871-88e1-a3ce00b8d7ae | main | ok | Erreur : le script `x-browser.js` n’a pas pu publier le twee |
| 302a0709-4a41-42ca-9b7a-4470d7838f8d | main | ok | ⚠️ API rate limit reached. Please try again later. |
| openclaw-watchguard | main | error | cron: job execution timed out |
| openclaw-backup-nightly | main | error | cron: job execution timed out |
| capability-evolver-weekly | main | ok | - |
| email-todo-6 | main | error | ⚠️ 📖 Read: from emails-pending-review.md failed |
| email-todo-9 | main | ok | - |
| email-todo-12 | main | ok | - |
| email-todo-15 | main | ok | - |
| email-todo-18 | main | ok | - |
## 3. Exécution des scripts

(Passé avec --no-scripts. Lancer `node TradeEmpire/trading-empire/scripts/cron-full-audit.js` pour l’audit scripts.)