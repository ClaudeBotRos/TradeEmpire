# Rapport tests et audits

Généré après exécution réelle des scripts et des crons. Preuves ci-dessous.

---

## 1. Test des scripts (sans LLM)

**Commande :** `node TradeEmpire/trading-empire/scripts/cron-test-and-audit.js --scripts-only`

**Résultat :** 11/11 scripts OK.

| Script | Exit | Durée | Résultat |
|--------|------|-------|----------|
| cleanup-unexecuted-decisions | 0 | 39 ms | OK |
| build-execution-queue | 0 | 41 ms | OK |
| executor-run | 0 | 477 ms | OK |
| morning-brief | 0 | 55 ms | OK |
| evening-brief | 0 | 54 ms | OK |
| boss-vision | 0 | 475 ms | OK |
| agent-status-report | 0 | 28533 ms | OK |
| scout-validation-status | 0 | 45 ms | OK |
| send-whatsapp-pending | 0 | 13438 ms | OK |
| technicals-scan | 0 | 6794 ms | OK |
| recovery-intraday-review (dry) | 0 | 385 ms | OK |

Rapport détaillé : `data/reports/CRON_TEST_AUDIT_202603082108.md` (ou le fichier généré à la date du test).

---

## 2. Test des crons réels (openclaw cron run)

Trois crons ont été lancés manuellement ; résultat lu depuis `cron/runs/<jobId>.jsonl` (dernière ligne).

### tradeempire-cleanup-unexecuted (agent: orchestrator)

- **CLI :** `openclaw cron run tradeempire-cleanup-unexecuted` → `ok: true, ran: true`, ~33 s.
- **Dernier run enregistré :** selon les lignes du fichier, un run récent peut afficher `status: ok, provider: openrouter, model: openai/gpt-oss-120b:free` ; la toute dernière ligne peut encore montrer un run antérieur en erreur. À vérifier après le prochain run planifié.

### tradeempire-intel (agent: intel)

- **CLI :** `openclaw cron run tradeempire-intel` → `ok: true, ran: true`, ~72 s.
- **Dernier run enregistré :** `status: ok`, `provider: openrouter`, `model: meta-llama/llama-3.3-70b-instruct`, `summary: "Intel OK — 20 cartes X et 10 cartes YouTube"`.
- **Conclusion :** Le correctif fallback (remplacement du modèle deepseek 404 par meta-llama) est validé en conditions réelles.

### tradeempire-tp-scrutator (agent: tibo)

- **CLI :** `openclaw cron run tradeempire-tp-scrutator` → `ok: true, ran: true`, ~123 s.
- **Dernier run enregistré :** `status: error`, `durationMs: 120059` (timeout à 120 s).
- **Correctif appliqué :** `timeoutSeconds` passé de 120 à **180** s pour ce job. À re-tester après déploiement.

---

## 3. Audits disponibles

### Audit par agent et dernier run

**Commande :**  
`node TradeEmpire/trading-empire/scripts/cron-audit-by-agent.js [--no-scripts]`

- Liste tous les crons avec l’agent config, activé, schedule, timeout.
- Pour chaque job ayant un run : agent exécutant (sessionKey), statut, provider, modèle, résumé.
- Synthèse : tableau Job | Agent | Statut | Résumé.
- Sans `--no-scripts` : appelle en plus `cron-full-audit.js` (long).

**Rapport :** `data/reports/CRON_AUDIT_BY_AGENT_YYYY-MM-DD.md`

### Audit complet des scripts (chaîne complète)

**Commande :**  
`node TradeEmpire/trading-empire/scripts/cron-full-audit.js`

- Exécute en conditions réelles chaque étape de chaque job (scripts seuls, pas d’appel LLM).
- Rapport par job et par étape : commande, CWD, exit, durée, vérification (fichier attendu, etc.).

**Rapport :** `data/reports/CRON_FULL_AUDIT_YYYY-MM-DD.md`  
**Attention :** peut être long (scripts type intel-scan, APIs externes). Option `--report-only` pour générer le squelette sans exécuter.

### Test ciblé scripts + crons

**Commande :**  
`node TradeEmpire/trading-empire/scripts/cron-test-and-audit.js [--scripts-only] [--crons-only] [--crons "id1,id2,id3"]`

- Par défaut : exécute les 11 scripts critiques puis les crons `tradeempire-cleanup-unexecuted`, `tradeempire-intel`, `tradeempire-tp-scrutator`.
- `--scripts-only` : uniquement les scripts (rapide).
- `--crons-only` : uniquement les crons (plus long, appelle le LLM).
- `--crons "id1,id2"` : liste de job IDs à lancer.

**Rapport :** `data/reports/CRON_TEST_AUDIT_<timestamp>.md`

---

## 4. Synthèse

| Élément | Résultat |
|--------|----------|
| Scripts (11) | 11/11 OK (preuve : exit 0, durées enregistrées). |
| Intel (fallback OpenRouter) | OK en run réel (meta-llama, summary reçu). |
| TP-scrutator | Timeout à 120 s → timeout augmenté à 180 s ; re-tester après prochain run. |
| Cleanup | CLI ran: true ; vérifier statut dans runs au prochain run planifié. |

Les modifications (timeouts, fallbacks, messages) sont donc fondées sur : (1) l’exécution réelle des scripts, (2) l’exécution réelle des crons et la lecture des runs, (3) les rapports d’audit générés par les scripts ci-dessus.
