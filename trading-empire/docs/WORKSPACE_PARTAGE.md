# Workspace partagé — objectif TradeEmpire

## Principe

**L’objectif principal de TradeEmpire est que les agents partagent tout.** Données, décisions, scripts, rapports : un seul contexte commun. BOSS, Tibo, Scout, Recovery, etc. travaillent sur les mêmes fichiers (`data/`, `scripts/`, dashboard).

## Conflit avec le comportement OpenClaw

Par défaut, OpenClaw associe à chaque agent un **workspace isolé** quand le cron utilise `sessionTarget: "isolated"` :

- **main** → `~/.openclaw/workspace`
- **boss** → `~/.openclaw/workspace-boss`
- **tibo** → `~/.openclaw/workspace-tibo`

Résultat : BOSS et Tibo tournaient dans un répertoire différent du reste de TradeEmpire, ce qui imposait de copier `TradeEmpire/` et multipliait les sources de vérité.

## Solution en place : symlinks

Pour garder **un seul workspace partagé** tout en laissant BOSS et Tibo être de vrais agents (même `agentId`, soul et modèle), on a remplacé les dossiers `workspace-boss` et `workspace-tibo` par des **liens symboliques** vers `workspace` :

```bash
# Les anciens dossiers ont été renommés en .bak si besoin de les retrouver.
ln -s workspace workspace-boss   # ~/.openclaw/workspace-boss → workspace
ln -s workspace workspace-tibo  # ~/.openclaw/workspace-tibo → workspace
```

Ainsi, quand OpenClaw lance un cron avec `agentId: "boss"` ou `"tibo"`, le CWD est toujours le **même** arbre de fichiers que pour `main`. Plus de copie à maintenir, et chaque agent garde son identité (soul, modèle, outils).
