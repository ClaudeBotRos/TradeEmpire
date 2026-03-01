# Attribution de modèles LLM par agent — TradeEmpire

Chaque agent TradeEmpire a une tâche spécifique (BOSS, ORCHESTRATOR, SENTIMENT_X, SMART_MONEY, TECHNICALS, RISK_JOURNAL). L’idéal est d’**attribuer un modèle LLM dédié (ou un profil)** par agent pour optimiser qualité, coût et pertinence.

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

### Option A — Per-agent dans OpenClaw (si supporté)

Si OpenClaw permet un **override de modèle par agent** (ex. `agents.<agentId>.model.primary` ou fichier `agents/<name>/model.json`), configurer pour chaque agent TradeEmpire :

- `agents.boss.model.primary` = `blockrun/reasoner`
- `agents.orchestrator.model.primary` = `blockrun/auto`
- etc.

À vérifier dans la doc ou le schéma OpenClaw (chemins du type `agents.defaults` vs `agents.<id>`).

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

- ClawRouter / BlockRun : `~/.openclaw/blockrun/`, extension `extensions/clawrouter/`, doc wallet `workspace/CLAWROUTER-WALLET.md`.
- Config agents OpenClaw : `openclaw.json` → `agents.defaults.model.primary`, `agents.defaults.models` (alias).
- PRD TradeEmpire : §3 (agents), §7 (outils).
- Routage et déclenchement : `trading-empire/docs/AGENTS_LLM_ROUTING.md`.

---
*Document de référence pour l’implémentation TradeEmpire — modèles LLM par agent.*
