# Chase (Tracker) — Post-mortem et feedback

## Rôle

Quand une idée est **APPROVED** par RISK_JOURNAL, elle est enregistrée pour suivi. L’agent **Chase** (Tracker) :

1. **Enregistrement** : À chaque APPROVED, un fichier `data/tracker/outcomes/{trade_id}.json` est créé avec `outcome: "pending"`.
2. **Résultat** : Vous (ou un système) remplissez ce fichier avec le résultat réel : `outcome` = `win` | `loss` | `invalid_hit` | `target_hit`, et optionnellement `exit_price`, `closed_at`, `note`.
3. **Post-mortem** : En lançant `node scripts/chase-tracker.js`, Chase génère pour chaque outcome complété un fichier `data/tracker/post_mortem/{trade_id}.md` (idée bonne ou mauvaise, pourquoi).
4. **Feedback** : Chase agrège les post-mortems et écrit un feedback par agent dans `data/tracker/feedback/{AGENT}.md` et `data/dashboard/chase_feedback.json`. Les agents peuvent s’en servir pour améliorer leur stratégie.

## Fichiers

| Fichier / Dossier | Description |
|-------------------|-------------|
| `data/tracker/outcomes/{trade_id}.json` | Résultat du trade (pending → win/loss/invalid_hit/target_hit). À remplir manuellement ou par clôture. |
| `data/tracker/post_mortem/{trade_id}.md` | Post-mortem généré par Chase (verdict + note). |
| `data/tracker/feedback/TECHNICALS.md` etc. | Feedback pour chaque agent. |
| `data/dashboard/chase_feedback.json` | Synthèse (timestamp, by_agent, post_mortem_count). |

## Commandes

- **Enregistrement automatique** : à chaque décision APPROVED, `risk-journal-scan.js` crée le fichier outcome en `pending`.
- **Générer post-mortems et feedback** : `node scripts/chase-tracker.js` (à lancer après avoir rempli les outcomes, ex. en fin de journée ou via cron).

## Dashboard

La vue **Chase (Tracker)** affiche le feedback par agent et la liste des post-mortems (cliquables pour lire le détail).
