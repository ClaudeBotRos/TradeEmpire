# Outils BOSS

- `scripts/boss-night.js` : agrège l’état du dashboard (roadmap, api_requests, agent_exchanges, kanban, costs) et écrit `data/dashboard/boss_night_context.json`. À exécuter en début de tâche nocturne (cron 01:00).
- **Rapport Tibo** : lire `data/dashboard/tibo_report.json` pour le suivi de l’exécution (ordres du jour, pending TP, solde, derniers runs executor/scrutator). Tibo est l’agent qui exécute les ordres et place les TP ; son rapport permet au BOSS d’avoir la vue exécution.
- Lecture/écriture : `data/dashboard/` (contexte, api_requests, agent_exchanges), `dashboard/spec/evolutions.md`, `dashboard/config/api_needs_priority.md`.
- Kanban : les tâches en « À faire » avec `source: boss_proposal` viennent des propositions validées par l’humain. Les implémenter (code, spec, config), puis écrire les id réalisés dans `data/dashboard/kanban_completed.json` : `{ "completed_ids": ["task-xxx", ...] }`. Ensuite lancer `node scripts/apply-kanban-completed.js` pour déplacer ces tâches en « Fait ».
