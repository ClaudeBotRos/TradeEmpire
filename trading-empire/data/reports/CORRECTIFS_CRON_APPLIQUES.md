# Correctifs appliqués — aucune erreur acceptée

Toutes les erreurs identifiées dans l’audit ont reçu une **solution concrète**.

## 1. Executor + TP scrutator (timeouts Tibo)

- **Problème :** `cron: job execution timed out` sur executor (08:25, 12:08, 15:08) et tp-scrutator.
- **Solution :**
  - **tradeempire-executor** : `timeoutSeconds` 120 → **180**
  - **tradeempire-executor-12h** et **tradeempire-executor-15h** : 150 → **180**
  - **tradeempire-tp-scrutator** : 60 → **120**

## 2. Intel (404 OpenRouter)

- **Problème :** `404 No endpoints found for deepseek/deepseek-r1-distill-qwen-32b:free`.
- **Solution :** Dans `openclaw.json`, pour **tous** les agents, le fallback OpenRouter `openrouter/deepseek/deepseek-r1-distill-qwen-32b:free` a été remplacé par **`openrouter/meta-llama/llama-3.3-70b-instruct`** (modèle utilisé par BOSS et fonctionnel).

## 3. Recovery intraday (timeouts + désactivés)

- **Problème :** Jobs 12:30, 15:30, 18:00 en erreur (timeout ou Provider error), et désactivés.
- **Solution :**
  - Les **3 jobs** sont **réactivés** (`enabled: true`), noms sans « [désactivé…] ».
  - Message mis à jour : « Tu es le Recovery Analyst. Lis … soul.md et tasks.md puis … » (chargement du rôle).
  - **timeoutSeconds** 120 → **180** pour les trois.

## 4. Watchguard (timeout)

- **Problème :** `cron: job execution timed out` (60 s).
- **Solution :** **timeoutSeconds** 60 → **120**.

## 5. Backup nightly (timeout)

- **Problème :** `cron: job execution timed out` (300 s) — backup Samba long.
- **Solution :** **timeoutSeconds** 300 → **600** (10 min).

## 6. Email-todo-6 (read emails-pending-review.md failed)

- **Problème :** L’agent lisait parfois le fichier avant que le script ne l’ait créé, ou en cas d’échec du script.
- **Solution :** Instruction renforcée dans le message (tous les email-todo) :  
  **« Si un read sur emails-pending-review.md échoue (fichier absent ou erreur), réponds « Aucun mail en attente. » et passe à (3). »**  
  → Aucun crash : le job répond toujours par un résumé (ou « Aucun mail en attente ») puis la todo.

---

**Fichiers modifiés :**
- `~/.openclaw/openclaw.json` (fallbacks OpenRouter)
- `~/.openclaw/cron/jobs.json` (timeouts, enabled, messages)

**Vérification :** Relancer l’audit après quelques runs :  
`node TradeEmpire/trading-empire/scripts/cron-audit-by-agent.js --no-scripts`
