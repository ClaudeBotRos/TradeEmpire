# Idées — Descriptions pour la relecture

Pour que les idées (TRADE_IDEA) soient compréhensibles dans le dashboard et le journal, chaque idée peut inclure :

## Champs recommandés

- **`description`** (string) : Résumé en langage naturel (2–4 phrases) : quoi (LONG/SHORT, symbole, TF), entrée/invalidation, objectifs, et si possible ce que signifient R:R et confidence pour cette idée.
- **`glossary`** (object) : Légende pour les indicateurs affichés.
  - **`rr`** : Explication de R:R (Risk:Reward = ratio gain cible / perte max).
  - **`confidence`** : Explication du score de confiance (0–1 ou 0–100%, sur quoi il est basé).
  - **`invalid`** : Explication du niveau d’invalidation (stop).

## Exemple (orchestrator-scan.js)

L’orchestrator remplit `description` et `glossary` pour chaque TRADE_IDEA. Le dashboard (vues Idées, Niches) affiche une **Référence** en haut (R:R, Confidence, Invalidation) et, pour chaque carte, la description + la légende si présentes.

## Autres agents

Tout agent qui produit ou enrichit une idée (ex. risk_journal qui ajoute une raison APPROVE/REJECT) peut ajouter un champ `description_review` ou enrichir `description` pour la relecture humaine.
