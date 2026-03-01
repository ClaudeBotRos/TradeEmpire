# Format Wire — Échanges entre agents

Fichier : `data/dashboard/agent_exchanges.json`. Alimenté par `run-morning.js` (via `scripts/wire-log.js`) à chaque étape du flux matin. Le dashboard affiche le module **Wire** à partir de ce fichier.

## Champs (PRD §6.12)

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique (généré si absent). |
| `timestamp_utc` | string | ISO 8601. |
| `from_agent` | string | TECHNICALS \| SMART_MONEY \| SENTIMENT_X \| ORCHESTRATOR \| RISK_JOURNAL \| BOSS. |
| `to_agent` | string | Destinataire ou `BROADCAST`. |
| `type` | string | REQUEST \| RESPONSE \| SHARE_SIGNAL \| BROADCAST. |
| `context` | object | Optionnel : `symbol`, `trade_id`, `window` (ex. morning_brief), `reason`. |
| `content_summary` | string | Résumé pour l’affichage dashboard. |
| `content_ref` | string | Optionnel : chemin vers fichier(s) ou dossier (signals, ideas, decisions). |

## Utilisation

- **Ajout d’une entrée** : depuis un script Node, `require('./scripts/wire-log.js').appendWire({ from_agent, to_agent, type, context, content_summary, content_ref })`.
- **Rétention** : les dernières `MAX_ENTRIES` (500) sont conservées dans le fichier.
- **API** : `GET /api/wire` retourne le tableau complet (trié par le front en ordre chronologique inverse).

## Exemple

```json
{
  "id": "wire-20260301081530-technicals",
  "timestamp_utc": "2026-03-01T08:15:30.123Z",
  "from_agent": "TECHNICALS",
  "to_agent": "ORCHESTRATOR",
  "type": "SHARE_SIGNAL",
  "context": { "window": "morning_brief" },
  "content_summary": "Signaux techniques (OHLCV, trend, levels) écrits.",
  "content_ref": "data/signals/technicals/"
}
```
