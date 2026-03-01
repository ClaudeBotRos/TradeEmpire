# Outils BOSS

- `scripts/boss-night.js` : agrège l’état du dashboard (roadmap, api_requests, agent_exchanges, kanban, costs) et écrit `data/dashboard/boss_night_context.json`. À exécuter en début de tâche nocturne (cron 01:00).
- Lecture/écriture : `data/dashboard/` (contexte, api_requests, agent_exchanges), `dashboard/spec/evolutions.md`, `dashboard/config/api_needs_priority.md`.
