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
