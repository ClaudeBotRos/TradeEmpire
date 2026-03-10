# Calendrier économique (Intel / Daphnée)

## Source principale : RapidAPI (Ultimate Economic Calendar)

- **RapidAPI — Ultimate Economic Calendar** : API utilisée en priorité par `economic-calendar-scan.js`.
- Dans **workspace/.env** (ou le `.env` chargé par `load-workspace-env.js`), ajoute :
  - **RAPIDAPI_KEY** = la valeur **X-RapidAPI-Key** de ton app RapidAPI (onglet App sur rapidapi.com, pour l’API « Ultimate Economic Calendar »).
  - Exemple : `RAPIDAPI_KEY=9bbdcb7ca9mshc32cf7f61c9818cp106d63jsnc3121624950a`
- Headers utilisés : `X-RapidAPI-Key` + `x-rapidapi-host: ultimate-economic-calendar.p.rapidapi.com`.
- Endpoint : GET `https://ultimate-economic-calendar.p.rapidapi.com/economic-events/tradingview?from=YYYY-MM-DD&to=YYYY-MM-DD&countries=US,DE,...`

## Autres sources

- **JBlanked** : si `RAPIDAPI_KEY` est absent ou l’API RapidAPI échoue, le script tente JBlanked avec `JBLANKED_API_KEY` (Forex Factory, 1 req/jour gratuite). Voir https://www.jblanked.com/news/api/docs/calendar/.

- **investing.com** : non utilisable (API 404, page Cloudflare).

- **Config manuelle** : sans clé, le script lit `dashboard/config/economic_calendar_events.json` (copier depuis `economic_calendar_events.example.json` si besoin).

## Fichiers

- `economic_calendar.json` : sortie du scan (date, événements, source utilisée).
- `dashboard/config/economic_calendar_events.json` : entrée manuelle (optionnel).
- `dashboard/config/economic_calendar_events.example.json` : exemple de structure.
