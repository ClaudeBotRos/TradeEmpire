# Outils Opportunity Scout

- **Planification** : 4 passages par jour (09:20, 12:25, 15:25, 17:55 Europe/Paris), juste avant les revues Recovery intraday (12:30, 15:30, 18:00), pour que les propositions soient à jour quand Recovery fait les ajustements.
- **Lecture** : `data/dashboard/watchlist.json`, `data/signals/technicals/` (derniers signaux par symbole/timeframe), `data/dashboard/niches/`, `data/dashboard/intel/trend_cards.json`. Fichiers de config (strategy_rules, risk_rules) pour rester dans le scope.
- **Script** : `node scripts/opportunity-scout.js` — exécute le scan et écrit `data/dashboard/scout_proposals.json`. Options : `--timeframes 1h,4h,1D` ; `--no-whatsapp` pour ne pas mettre en file WhatsApp. Si au moins une proposition (seuil `SCOUT_MIN_PROPOSALS_WHATSAPP`, défaut 1) : envoi d'un rapport court en file `data/notifications/whatsapp_pending.json` (consommée par le cron OpenClaw / canal WhatsApp).
- **Pas d’écriture** hors `scout_proposals.json`, file WhatsApp et logs ; pas d’appel API d’ordre ou de modification de la watchlist.
