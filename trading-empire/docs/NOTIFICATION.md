# Notification — Canal unique (PRD §2.1, §9.3)

Un **seul** canal de notification est branché sur l’ORCHESTRATOR : daily brief après la séquence matin, envoyé via le cron OpenClaw (livraison WhatsApp).

## Flux

1. **08:15** — Cron `tradeempire-morning` : l’agent exécute `run-morning.js` puis `morning-brief.js`.
2. La sortie de `morning-brief.js` (brief du jour) est utilisée comme réponse de l’agent.
3. OpenClaw envoie cette réponse sur **WhatsApp** (config cron : `delivery.mode: announce`, `channel: whatsapp`, `to`, `accountId`).

## Contenu du brief

- Titre et date.
- Nombre d’idées du jour, APPROVED, REJECTED (et NEED_MORE_INFO si présent).
- Liste des symboles approuvés (ex. BTCUSDT, ETHUSDT).
- Rappel : journal et dashboard pour le détail.

## Fichiers

- **Génération** : `scripts/morning-brief.js` (lit `data/ideas/`, `data/decisions/`, écrit `data/journal/{date}_brief.md`, affiche le brief sur stdout).
- **Consultation** : `data/journal/{date}_brief.md` ; API dashboard `GET /api/journal/{date}/brief` (optionnel).

## Soir (20:30)

Le cron `tradeempire-evening` exécute `risk-journal-scan.js` (mise à jour du journal). Aucun envoi par défaut ; pour activer un récap soir sur WhatsApp, ajouter `delivery: { mode: "announce", channel: "whatsapp", ... }` au job.

## Brief BOSS (nuit, 01:00)

Le **brief de nuit du BOSS** doit être **adressé à l'utilisateur tel quel**, avec les mots et la personnalité du BOSS (voir `agents/boss/soul.md`). Ce brief est la réponse complète du BOSS (pas une ligne de synthèse) et doit être envoyé sur WhatsApp.

- **Cron** : `tradeempire-boss-night`. Le job doit avoir `delivery.mode: "announce"`, `channel: "whatsapp"`, et les mêmes `to` / `accountId` que le brief matin.
- **Message du job** : le point (5) du message doit demander au BOSS de répondre par son **brief de nuit complet** (adressé à l'utilisateur, avec ses mots et sa personnalité), et non par une ligne de synthèse. Remplacer par exemple par : « (5) Réponds par ton **brief de nuit complet** adressé à l'utilisateur (tes mots, ta personnalité — voir agents/boss/soul.md). Cette réponse sera envoyée telle quelle sur WhatsApp ; pas une ligne de synthèse. » La réponse de l'agent = le brief envoyé à l'utilisateur sans modification.
- **Exemple de bloc delivery** (à mettre dans `cron/jobs.json` pour le job `tradeempire-boss-night`) :
  ```json
  "delivery": {
    "mode": "announce",
    "channel": "whatsapp",
    "to": "+33625174653",
    "accountId": "custom-1",
    "bestEffort": true
  }
  ```

## Messages importants (tous les agents)

Chaque agent a le **droit d'envoyer un message WhatsApp** à l'utilisateur en cas de message important. Voir `docs/AGENT_WHATSAPP.md` et le script `scripts/notify-user-whatsapp.js` (file d'attente `data/notifications/whatsapp_pending.json`).
