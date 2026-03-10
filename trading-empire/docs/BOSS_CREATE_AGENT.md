# BOSS — Création d’un agent

Quand le besoin s’en fait sentir, le BOSS peut **créer un nouvel agent** sans validation humaine préalable.

## Procédure (côté BOSS)

1. **Écrire** le fichier `data/dashboard/boss_create_agent_spec.json` avec le contenu suivant :

```json
{
  "agent_id": "mon_agent",
  "display_name": "Mon Agent",
  "skills_short": "Une phrase pour le dashboard.",
  "soul_md": "# Mon Agent — Soul\n\n## Personnalité\n\n...",
  "tasks_md": "# Tâches Mon Agent\n\n1. ...",
  "tools_md": "# Outils Mon Agent\n\n- ...",
  "cron_schedule": "30 10 * * *",
  "cron_message": "Message pour le job cron (agentTurn)."
}
```

- **Obligatoire** : `agent_id` (snake_case, sans caractères spéciaux), `display_name`, `soul_md`, `tasks_md`, `tools_md`.
- **Optionnel** : `skills_short`, `cron_schedule` (expression cron Europe/Paris), `cron_message`.

2. **Exécuter** : `node scripts/create-agent-from-spec.js`

## Effets du script

- Crée le dossier `agents/<agent_id>/` avec `soul.md`, `tasks.md`, `tools.md`.
- Ajoute une entrée dans `dashboard/config/team.json` (photo par défaut `agent.png`).
- Si `cron_schedule` ou `cron_message` sont fournis : écrit `data/dashboard/suggested_cron_agent_<id>.json` (snippet à copier dans `~/.openclaw/cron/jobs.json` si tu veux planifier l’agent).
- Supprime `boss_create_agent_spec.json` après succès.

## Vérification

- `--dry-run` : affiche ce qui serait fait sans créer de fichier.
- Ne pas créer un agent dont l’`agent_id` existe déjà (le script refusera si le dossier existe).

## Référence

- `agents/boss/tools.md` — description de l’outil côté BOSS.
- `scripts/create-agent-from-spec.js` — code du script.
