# Test et audit crons — 2026-03-08T21:08:31.752Z

## 1. Exécution des scripts (sans LLM)

| Script | Exit | Durée (ms) | Résultat |
|--------|------|------------|----------|
| cleanup-unexecuted-decisions | 0 | 39 | OK |
| build-execution-queue | 0 | 41 | OK |
| executor-run | 0 | 477 | OK |
| morning-brief | 0 | 55 | OK |
| evening-brief | 0 | 54 | OK |
| boss-vision | 0 | 475 | OK |
| agent-status-report | 0 | 28533 | OK |
| scout-validation-status | 0 | 45 | OK |
| send-whatsapp-pending | 0 | 13438 | OK |
| technicals-scan | 0 | 6794 | OK |
| recovery-intraday-review (dry) | 0 | 385 | OK |

**Résumé scripts :** 11/11 OK.

---

Rapport généré par `cron-test-and-audit.js`.