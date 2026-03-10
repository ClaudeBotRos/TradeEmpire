# Évolutions dashboard (BOSS - propositions nocturnes)

*Ce fichier est mis à jour par la tâche nocturne BOSS. Propositions d'amélioration du dashboard (modules, UX, données).*

## Dernière mise à jour

- **Date** : 2026-03-10 (mise à jour nocturne)
- **Source** : BOSS tâche nocturne

## Observations récentes

- **Post‑mortems** : 29 post‑mortems enregistrés, feedback écrit pour 6 agents. Données âgées de ~4h — à rafraîchir.
- **Trend Cards** : 12 cartes (X, YouTube, macro). Narratives : ETF/spot, régulation, tensions short-term Bitcoin. Filtre YouTube borderline actif.
- **Échanges agents** : 327 échanges, activité soutenue. Flux complet orchestré.
- **Coûts API** : OpenRouter 0.011 USD, X API 7.49 USD/mois (1498/2M requêtes). Fichier coûts âgé de 5 jours — **CRITIQUE**.
- **Exécution** : Trading réel V2 activé (8/8 roadmap). Solde disponible : 108.26 USDT, 0 positions ouvertes, PnL réalisé : +8.95 USDT (33 trades, 78.8% win rate).

## Propositions implémentées

- **Visualisation des coûts API** : tableau récapitulatif des coûts API (`costs.api_costs`) ajouté, mise à jour chaque nuit.
- **Intégration des Trend Cards X** : widget affichant titre, résumé et lien de la dernière Trend Card X intégré.
- **Résumé du feedback Chase** : panneau résumant post-mortems et commentaires par agent ajouté.
- **Statistiques des échanges d'agents** : affichage du total d'échanges et top 3 paires d'agents les plus actives implémenté.
- **Kanban dynamique** : mise à jour automatique de la colonne "À faire" avec les tâches provenant des besoins API priorisés.

## Nouvelles propositions (en attente de validation)

Les propositions suivantes ont été soumises dans `data/dashboard/boss_proposals.json` pour validation humaine :

1. **Tableau de bord des performances par agent** - Widget agrégant les feedbacks Chase, résultats de trades et métriques de qualité par agent, avec tendance et score.
2. **Visualisation réseau des échanges d'agents** - Graphe interactif (ou simplifié) des échanges entre agents, montrant les paires les plus actives et le volume de messages.
3. **Filtrage et classification des Trend Cards** - Filtres par source (X, YouTube, macro, Reddit) et classification (borderline, etc.) dans le module Intel.
4. **Intégration des coûts API réels** - Remplir les coûts manquants avec valeurs réelles ou estimations, ajouter suivi mensuel et alerte budget.
5. **Préparation du module d'exécution V2** - Widget de simulation de trades montrant idées approuvées, entrées/sorties simulées et P&L hypothétique, en préparation de l'exécution réelle.
6. **Module de diagnostic des pertes** - Analyse des causes communes des trades perdants (signaux, timing, conditions marché) pour améliorer le risk management.

## Priorités immédiates (dérivées des observations)

- **Refresh automatique des coûts API** : fichier costs âgé de 5 jours — automatiser la mise à jour nocturne des coûts OpenRouter et X API (PRIORITÉ 1).
- **Filtrage qualité YouTube** : limiter le bruit des Trend Cards YouTube (majorité "borderline"). Config `dashboard/config/intel_youtube_filter.json` : `max_borderline_cards`.
- **Analyse des pertes** : 7 trades perdants sur 33 — créer un module de diagnostic pour identifier les patterns d'échec.
- **Suivi des requêtes X API** : 1498/2M requêtes (reset le 23) — surveillance mensuelle pour ajuster le plan.

## Historique

- *2026-03-01* : création initiale du fichier par BOSS.
- *2026-03-02* : ajout des propositions implémentées (visualisation coûts API, Trend Cards X, feedback Chase, statistiques échanges, Kanban dynamique).
- *2026-03-04* : ajout de cinq nouvelles propositions pour amélioration continue (performances agents, réseau échanges, filtrage Trend Cards, coûts API réels, module exécution V2).
- *2026-03-10* : ajout proposition "Module de diagnostic des pertes", mise à jour observations (327 échanges, 108.26 USDT solde, 8.95 USDT PnL réalisé).