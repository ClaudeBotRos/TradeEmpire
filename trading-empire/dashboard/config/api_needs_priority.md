# Priorisation des besoins API (BOSS — mise à jour nocturne)

*Ce fichier est mis à jour par la tâche nocturne BOSS à partir de `data/dashboard/api_requests.json`.*

## Dernière mise à jour

- **Date** : 2026-03-10
- **Source** : BOSS tâche nocturne

## Priorité 1 (à traiter en premier)

- **Refresh automatique des coûts API nightly** : fichier costs âgé de 5 jours (131h) — automatiser la mise à jour nocturne des coûts OpenRouter et X API. **CRITIQUE** pour suivi financier précis.

## Priorité 2

- **Filtrage qualité YouTube** : limiter le bruit des Trend Cards YouTube (majorité "borderline"). Config `dashboard/config/intel_youtube_filter.json` : `max_borderline_cards` pour plafonner le nombre de cartes borderline remontées.

## Priorité 3

- **Module de diagnostic des pertes** : 7 trades perdants sur 33 (21.2% loss rate) — analyser les causes communes (signaux défaillants, conditions marché, timing, risk management) pour améliorer la performance.

## Priorité 4

- **Suivi des requêtes X API** : suivi mensuel des requêtes (1498/2M, reset le 23) pour ajuster le plan si besoin.

## Priorité 5 / Plus tard

- **Optimisation OpenRouter** : surveiller l'évolution de l'usage avec l'augmentation des échanges agents (327 échanges aujourd'hui).

## Notes

- **ClawRouter** : ignoré — on utilise UNIQUEMENT OpenRouter.
- Le fichier `data/dashboard/api_requests.json` est vide — aucune nouvelle demande d'API détectée.
- **Données vieillissantes** : Chase feedback (~4h), recovery report (~3.75h), costs (~131h) — prioriser refresh nocturne des coûts.
- **Performance trading** : 33 trades clôturés, 78.8% win rate, +8.95 USDT PnL réalisé — excellente performance globale.
