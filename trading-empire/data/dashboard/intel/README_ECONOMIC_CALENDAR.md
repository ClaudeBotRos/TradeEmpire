# Calendrier économique (Intel / Daphnée)

## Situation des sources

- **investing.com** : l’API historique (`Service.getCalendarFilteredData`) renvoie **404**. La page est protégée par **Cloudflare** ; un simple fetch ou un navigateur headless reçoit la page de défi, pas le tableau d’événements. **Non utilisable** en l’état.

- **JBlanked** : API tierce qui agrège Forex Factory / MQL5 / FxStreet. **Recommandé** pour avoir un vrai calendrier.
  - Inscription : https://www.jblanked.com/
  - Clé API : https://www.jblanked.com/api/key/
  - Doc : https://www.jblanked.com/news/api/docs/calendar/
  - Gratuit : **1 requête par jour** (au-delà, payant).
  - Dans le workspace (ou `.env`) : `JBLANKED_API_KEY=ta_cle`
  - Le script `economic-calendar-scan.js` appelle alors `forex-factory/calendar/range/?from=...&to=...` et enregistre les événements dans `economic_calendar.json`.

- **Config manuelle** : si aucune clé JBlanked, le script lit `dashboard/config/economic_calendar_events.json`. Tu peux copier `economic_calendar_events.example.json` vers ce fichier et renseigner les événements à la main (ou les importer d’ailleurs).

## Fichiers

- `economic_calendar.json` : sortie du scan (date, événements, source utilisée).
- `dashboard/config/economic_calendar_events.json` : entrée manuelle (optionnel).
- `dashboard/config/economic_calendar_events.example.json` : exemple de structure.
