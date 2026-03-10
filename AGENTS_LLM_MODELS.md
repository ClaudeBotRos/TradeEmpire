# Attribution de modèles LLM par agent — TradeEmpire

Chaque agent TradeEmpire a une tâche spécifique et une **soul** (personnalité). L’idéal est d’**attribuer un modèle LLM adapté** par agent pour qualité, coût et pertinence.

---

## Comment utiliser des modèles différents selon les agents (OpenClaw)

Le schéma OpenClaw attend **`agents.list`** (tableau d’agents), pas des clés comme `agents.main`, `agents.boss`, `agents.tibo`. Chaque élément de `list` a au minimum :

- **`id`** : identifiant de l’agent (ex. `main`, `boss`, `tibo`)
- **`model`** : chaîne `provider/model` (ex. `blockrun/reasoner`)
- **`default`** (optionnel) : `true` pour l’agent par défaut (souvent `main`)

Les jobs cron qui précisent `agentId: "boss"` ou `"tibo"` dans `cron/jobs.json` sont routés vers l’agent correspondant ; le modèle utilisé est celui défini dans `agents.list` pour cet `id`. Références : [Multi-Agent](https://docs.openclaw.ai/concepts/multi-agent), [Models](https://docs.openclaw.ai/concepts/models), [Config schema](https://config.clawi.sh/).

---

## Calibration : ClawRouter + OpenRouter uniquement (pas de clé Anthropic)

On n’utilise **pas** de clé API Anthropic. Tous les appels LLM passent par :

- **BlockRun (ClawRouter)** : proxy local `http://127.0.0.1:8402/v1`, auth `x402-proxy-handles-auth`. Modèles : `blockrun/free`, `blockrun/auto`, `blockrun/reasoner`, `blockrun/codex`, etc.
- **OpenRouter** : pour les tâches longues (ex. BOSS) et modèles listés en `agents.defaults.models` : `openrouter/qwen/qwen-2.5-72b-instruct`, `openrouter/deepseek/deepseek-r1-distill-qwen-32b:free`, `openrouter/openai/gpt-oss-120b:free`.

Pour éviter `FailoverError: No API key found for provider "anthropic"` :

- Les modèles dont l’id commence par `anthropic/` ont été **retirés** du registre (`openclaw.json` et `agents/main/agent/models.json`), pour que le runtime ne tente jamais le provider Anthropic.
- Les **fallbacks** par défaut sont limités à BlockRun : `agents.defaults.model.fallbacks = ["blockrun/auto", "blockrun/eco"]`.
- Les agents `main`, `boss`, `tibo` ont des profils d’auth **blockrun** et **openrouter** uniquement (pas de profil `anthropic`).

Aucune clé Anthropic n’est donc nécessaire.

---

## Tâches longues (BOSS) → OpenRouter

Pour les tâches longues (brief de nuit, vision, Kanban), **blockrun/reasoner** pouvait timeouter ou être en rate limit. Le BOSS utilise donc en priorité **OpenRouter** : **primary** `openrouter/qwen/qwen-2.5-72b-instruct` (Qwen 2.5 72B), **fallbacks** : `openrouter/deepseek/deepseek-r1-distill-qwen-32b:free` (gratuit), puis `blockrun/reasoner`, puis `blockrun/auto`. Ainsi en cas d’échec Qwen on tente un autre OpenRouter avant BlockRun (limite le rate_limit).

---

## 0. État actuel (audit)

| Job / rôle | OpenClaw agentId | Modèle effectif | Modèle cible |
|------------|------------------|------------------|--------------|
| tradeempire-morning, evening, intel, agent-report | `main` | blockrun/auto | blockrun/auto |
| tradeempire-boss-night, tradeempire-boss-vision | `boss` | openrouter/qwen/qwen-2.5-72b-instruct | OpenRouter Qwen 72B (fallbacks: r1-qwen32b-free, blockrun/reasoner, blockrun/auto) |
| tradeempire-executor*, Tibo | `tibo` | blockrun/codex | blockrun/codex |

**Config correcte** : dans `openclaw.json`, utiliser **`agents.list`** (tableau), pas `agents.main` / `agents.boss` / `agents.tibo` (clés non reconnues par le schéma). Chaque entrée a `id` et `model` :

```json
"agents": {
  "defaults": { "model": { "primary": "blockrun/free", "fallbacks": [...] }, "models": { ... } },
  "list": [
    { "id": "main", "default": true, "model": "blockrun/auto" },
    { "id": "boss", "model": "blockrun/reasoner" },
    { "id": "tibo", "model": "blockrun/codex" }
  ]
}
```

Référence détaillée : `trading-empire/config/agents_models.json`. Doc OpenClaw : [Multi-Agent](https://docs.openclaw.ai/concepts/multi-agent), [Models](https://docs.openclaw.ai/concepts/models).

---

## 1. ClawRouter (BlockRun) — recommandé comme base

**ClawRouter** est déjà intégré à OpenClaw (proxy x402, wallet USDC, multi-modèles). Il fournit :

- **Routage par complexité** : SIMPLE / MEDIUM / COMPLEX / agentic selon le prompt (règles, scoring).
- **Profils** : `free`, `eco`, `auto`, `premium` (qualité/coût).
- **Alias de modèles** : `blockrun/reasoner`, `blockrun/codex`, `blockrun/sonnet`, `blockrun/opus`, `blockrun/deepseek`, `blockrun/gemini`, etc.

**Intérêt pour TradeEmpire** : une seule stack (ClawRouter), pas de clé API par modèle, paiement à la requête. En revanche, le routage actuel est **par contenu de la tâche**, pas **par identité d’agent**.

**Recommandation** : utiliser ClawRouter comme **provider unique** pour TradeEmpire, et ajouter une couche **per-agent** soit dans OpenClaw, soit dans la config TradeEmpire (voir §3).

---

## 2. Modèles suggérés par agent (logique métier)

| Agent | Rôle | Modèle / profil suggéré | Justification |
|-------|------|-------------------------|----------------|
| **BOSS** | Pilote, arbitrage, amélioration dashboard | `blockrun/reasoner` ou `premium` | Raisonnement, synthèse, décisions stratégiques. |
| **ORCHESTRATOR** | Consolidation, brief, coordination | `blockrun/auto` ou `blockrun/sonnet` | Équilibre qualité/coût ; beaucoup d’appels. |
| **SENTIMENT_X** | Sentiment, narratifs, texte X | `blockrun/gemini` ou `blockrun/kimi` | Bon sur texte long, résumés, nuance. |
| **SMART_MONEY** | Données structurées, métriques | `blockrun/codex` ou `blockrun/deepseek` | Données structurées, JSON, chiffres. |
| **TECHNICALS** | Signaux techniques, JSON, niveaux | `blockrun/codex` ou `blockrun/deepseek` | Output structuré (TRADE_IDEA, SIGNAL). |
| **RISK_JOURNAL** | Conformité, règles, journal | `blockrun/reasoner` ou `blockrun/sonnet` | Application stricte de règles, cohérence. |

Les alias exacts dépendent du catalogue BlockRun/ClawRouter (reasoner, codex, etc.). À adapter selon les modèles réellement disponibles et le coût cible.

---

## 3. Mise en œuvre : options

### Option A — Per-agent dans OpenClaw (recommandé, en place)

Utiliser **`agents.list`** dans `openclaw.json` : tableau d’entrées `{ "id": "<agentId>", "model": "provider/model" }`. Exemple : `main` → `blockrun/auto`, `boss` → `blockrun/reasoner`, `tibo` → `blockrun/codex`. Les jobs cron avec `agentId: "boss"` ou `"tibo"` utilisent alors le modèle défini pour cet agent. Chaque agent doit exister sous `~/.openclaw/agents/<id>/agent/` (auth-profiles.json). Doc : [Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent), schéma [config.clawi.sh](https://config.clawi.sh/) (`agents.list`, `agents.list[].model`).

### Option B — Config TradeEmpire + exécution

Créer un fichier **TradeEmpire** qui mappe agent → modèle, et s’en servir à l’invocation :

- Fichier : `trading-empire/config/agents_models.json` (ou dans `workspace/TradeEmpire/`).

Exemple :

```json
{
  "boss": "blockrun/reasoner",
  "orchestrator": "blockrun/auto",
  "sentiment_x": "blockrun/gemini",
  "smart_money": "blockrun/codex",
  "technicals": "blockrun/codex",
  "risk_journal": "blockrun/reasoner"
}
```

Au moment de lancer une tâche pour un agent (cron, script, ou couche d’orchestration), lire ce fichier et passer le modèle à OpenClaw (variable d’environnement, argument, ou patch de config selon ce qu’OpenClaw accepte).

### Option C — ClawRouter avec hint « agent »

Si ClawRouter (ou le proxy BlockRun) accepte un **hint** (header ou param) du type `X-Agent-Id: technicals`, on peut ajouter une règle côté router : selon l’agent, forcer un profil ou un modèle. Cela demanderait une évolution de l’extension ClawRouter (routing par agent en plus du scoring par contenu).

### Option D — Un modèle pour tous (fallback)

En attendant une vraie attribution per-agent : garder **un seul modèle** (ex. `blockrun/auto`) pour tous les agents. ClawRouter continuera à adapter un peu selon la complexité du prompt, mais sans spécialisation explicite par agent.

---

## 4. Recommandation synthétique

1. **Garder ClawRouter** comme stack LLM (déjà en place, wallet, multi-modèles).
2. **Viser une attribution explicite par agent** : soit via OpenClaw (Option A), soit via un fichier de config TradeEmpire lu à l’exécution (Option B).
3. **Documenter** dans chaque dossier agent (ex. `agents/technicals/tools.md` ou `identity.md`) le **modèle recommandé** pour cet agent, même si le moteur utilise encore un défaut global.
4. Si l’équipe OpenClaw/BlockRun peut ajouter un **routing par agent** dans ClawRouter (Option C), ce serait la solution la plus propre à long terme.

---

## 5. Références

- Config modèles par agent : `trading-empire/config/agents_models.json`.
- Config agents OpenClaw : `openclaw.json` → `agents.defaults`, `agents.main`, `agents.boss`, `agents.tibo`.
- ClawRouter / BlockRun : `~/.openclaw/blockrun/`, extension `extensions/clawrouter/`.
- Routage et déclenchement : `trading-empire/docs/AGENTS_LLM_ROUTING.md`.
- Soul des agents : `trading-empire/agents/*/soul.md`.

---
*Document de référence pour l’implémentation TradeEmpire — modèles LLM par agent.*
