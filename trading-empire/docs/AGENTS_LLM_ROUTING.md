# Routage LLM et déclenchement des agents TradeEmpire

## En bref

- **Oui**, le déclenchement (cron) envoie bien un **agentTurn** à OpenClaw, qui est traité par un **LLM** (modèle par défaut : `blockrun/free` dans `openclaw.json` → `agents.defaults.model.primary`).
- **Oui**, les crons TradeEmpire sont **actifs** (`enabled: true` dans `cron/jobs.json`). Le scheduler OpenClaw doit être lancé pour que les jobs s’exécutent à l’heure.
- Les **« agents » TradeEmpire** (BOSS, ORCHESTRATOR, TECHNICALS, etc.) sont des **scripts Node.js** : la logique métier (signaux, idées, décisions, journal) ne passe pas par un LLM. C’est l’**agent OpenClaw** (LLM) qui reçoit le tour, exécute la consigne (ex. « lance run-morning.js ») et répond avec la sortie.

---

## Flux actuel

1. **Cron** (ex. 08:15) → le scheduler OpenClaw déclenche le job `tradeempire-morning`.
2. **Payload** `agentTurn` avec un **message** (ex. « Exécute run-morning.js puis morning-brief.js, réponds avec la sortie »).
3. OpenClaw attribue ce tour à un **agent** (session). Si le job a un `agentId` (ex. `main`), cet agent est utilisé ; sinon l’agent par défaut.
4. L’**agent (LLM)** reçoit le message, utilise ses outils (ex. exécution de commandes), lance les scripts TradeEmpire, et renvoie la réponse.
5. Si le job a **delivery** (ex. WhatsApp), la réponse est envoyée sur le canal.

Donc : **un LLM est bien en bout de chaîne** pour interpréter la consigne et lancer les scripts. Les scripts eux-mêmes (technicals-scan.js, orchestrator-scan.js, etc.) ne font **pas** d’appel LLM.

---

## Routage « un modèle par agent TradeEmpire »

Aujourd’hui il n’y a **pas** de routage distinct par agent TradeEmpire (BOSS, ORCHESTRATOR, etc.) : tous les jobs TradeEmpire envoient un agentTurn au **même** agent OpenClaw (défaut ou `main`), donc au même modèle (ex. `blockrun/free`).

Pour avoir **un modèle LLM dédié par agent** (ex. BOSS → reasoner, ORCHESTRATOR → auto), il faudrait soit :

- que les jobs précisent un **agentId** différent par type de tâche (ex. `boss` pour la tâche nocturne) et qu’OpenClaw expose des agents avec des modèles différents (`agents.boss.model.primary`, etc.),  
- soit une couche côté TradeEmpire/OpenClaw qui choisit le modèle en fonction du job (voir `AGENTS_LLM_MODELS.md`).

---

## Jobs TradeEmpire et agentId

Dans `cron/jobs.json`, les jobs TradeEmpire peuvent préciser **agentId** pour cibler un agent OpenClaw donné :

| Job | agentId (recommandé) | Rôle |
|-----|----------------------|------|
| tradeempire-morning | `main` (ou omis = défaut) | Exécute run-morning + morning-brief, répond avec le brief → WhatsApp. |
| tradeempire-evening | `main` ou omis | Exécute risk-journal-scan.js. |
| tradeempire-boss-night | `main` ou `boss` si configuré | Exécute boss-night.js, met à jour spec/config. |

Si OpenClaw a un agent `boss` avec un modèle dédié (ex. `blockrun/reasoner`), on peut mettre `"agentId": "boss"` sur `tradeempire-boss-night` pour router ce job vers ce modèle. La config des agents se fait dans `openclaw.json` (ou équivalent).

---

## Vérifier que le déclenchement est actif

1. **Crons** : dans `cron/jobs.json`, les jobs `tradeempire-morning`, `tradeempire-evening`, `tradeempire-boss-night` ont `"enabled": true`.
2. **Scheduler** : OpenClaw doit exécuter ce fichier de jobs (service ou processus qui lit les crons et envoie les payloads agentTurn). Voir la doc OpenClaw pour l’activation du scheduler.
3. **Résultat** : après 08:15, un tour est créé, les scripts sont lancés, et si tout va bien le brief est envoyé sur WhatsApp.

---

## Références

- `openclaw.json` → `agents.defaults.model.primary`, `agents.defaults.models`
- `workspace/TradeEmpire/AGENTS_LLM_MODELS.md` — modèles suggérés par agent et options de mise en œuvre
- `cron/jobs.json` — définitions des jobs (payload, delivery, enabled)
