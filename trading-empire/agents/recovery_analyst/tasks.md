# Tâches Recovery Analyst

## Volets outcomes (soir)

1. **Lire les outcomes Chase** : parcourir `data/tracker/outcomes/*.json`, extraire pour chaque fichier : trade_id, symbol, outcome (win | loss | invalid_hit | target_hit), closed_at, note. Ignorer les outcomes encore en `pending`.
2. **Agréger par symbole et par cause** : par symbole, compter win/loss/invalid_hit/target_hit ; globalement par outcome. Produire `data/dashboard/recovery_report.json` et optionnellement `data/reports/YYYY-MM-DD_recovery.md`.
3. **Alimenter BOSS / dashboard** : le rapport est lu par boss-night, boss-vision et le dashboard (API recovery_report).

## Volets revue intraday (2 à 3 fois par jour)

4. **Réévaluer les ordres réellement en place sur ASTER** : récupérer les ordres ouverts via l’API ASTER (getOpenOrders), ne pas traiter les idées/décisions. Ne considérer que les ordres d’entrée (LIMIT sans stopPrice). Pour chaque ordre : symbole, side (BUY=long, SELL=short) ; trend actuel (technicals) ; recommandation **keep** ou **cancel**.
5. **Annulation sur ASTER** : avec `--apply-cancel`, appeler cancelOrder(symbol, orderId) pour chaque ordre recommandé cancel.
6. **Scout** : lire scout_proposals.json ; proposer les candidats diversification en sortie. Rapport : recovery_intraday_report.json (source ASTER), option `--md`, option `--apply-cancel`. Crons 12h30, 15h30, 18h.
