# Audit complet des crons — Procédure

## Objectif

Vérifier **en conditions réelles** que chaque job cron activé exécute bien les scripts prévus, sans omission ni tricherie. Chaque action, chaque tâche, chaque script est exécuté et rapporté.

## Commande

Depuis la **racine du workspace** OpenClaw (`~/.openclaw/workspace`) :

```bash
node TradeEmpire/trading-empire/scripts/cron-full-audit.js
```

- **Sans** `--report-only` : exécution réelle de chaque script (build queue, executor, morning, evening, scout, chase, recovery, watchguard, backup, imap, etc.).
- **Avec** `--report-only` : génère uniquement la structure du rapport sans lancer les scripts.

## Durée

Comptez **plusieurs minutes** (souvent 5–10 min) : la séquence matin (`run-morning.js`) enchaîne de nombreux scripts (intel, technicals, smart money, sentiment, orchestrator, risk journal, etc.).

## Rapport

Le rapport est écrit dans :

```
TradeEmpire/trading-empire/data/reports/CRON_FULL_AUDIT_YYYY-MM-DD.md
```

Pour chaque job activé :

- **Nom** et **id** du job
- **Tableau** : numéro d’étape, commande, CWD, code de sortie, durée, vérification (fichier attendu, JSON, etc.), résultat OK/FAIL
- En cas d’échec : extrait stderr/error

Sont couverts :

- Tous les jobs **enabled: true** dans `cron/jobs.json` (TradeEmpire cleanup, morning, executor, TP scrutator, evening, BOSS night, Intel, Scout, validation, WhatsApp pending, Recovery analyst, Chase, Veille airdrops, Watchguard, Backup, capability-evolver, email-todo x5).
- Le **Recovery intraday** (scripts techniques + contexte + revue), prévu pour le crontab système (sans `--apply-cancel` pendant l’audit).

## Synthèse en fin de rapport

- Nombre d’étapes exécutées
- OK / FAIL

Aucune étape n’est simulée : chaque ligne du rapport correspond à une exécution réelle du script concerné.
