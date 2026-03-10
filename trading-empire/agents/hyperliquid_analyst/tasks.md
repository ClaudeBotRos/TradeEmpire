# Tâches Hyperliquid Analyst

1. **Actualiser la liste des actifs tokenisés** : exécuter le script qui interroge l’API Hyperliquid (`meta` ou `metaAndAssetCtxs`) et filtre les perpétuels matières premières (or, pétrole, etc.). Écrire ou mettre à jour `data/hyperliquid/commodities_meta.json` (symboles, noms, paramètres). Référence : `docs/HYPERLIQUID_COMMODITIES.md`.

2. **Analyser tendances et contexte** : le script `hyperliquid-analyst-trend.js` charge automatiquement : données HL (commodities_meta), **Parvati** (news_scan_report → catalysts or/oil/macro), **Intel** (trend_cards → situation_summary, themes), **calendrier économique** (événements du jour), **flux RSS HIP-3** (Kitco or/métaux, Yahoo Finance actions, config dans `hyperliquid_analyst_sources.json`). Lire le rapport généré (context_news, context_intel, context_macro, context_hip3_news) pour produire une analyse et des recommandations fondées sur ce contexte.

3. **Rapport et recommandations** : le rapport contient `context_news`, `context_intel`, `context_macro`, `context_hip3_news` (remplis par le script) et `recommendations` avec `{ "symbol", "side", "reason", "confidence", "data_sources" }`. Enrichir ou valider les recommandations en vous appuyant sur ces contextes (or/pétrole/actions/macro). L’exécution reste validée par le BOSS ou le flux existant (décisions → executor).

4. **Alimenter le BOSS et le dashboard** : le rapport est lu par le BOSS (vision / nuit) et peut être affiché dans une vue dédiée ou une carte sur le dashboard. Optionnel : résumé court en file WhatsApp si seuil de confiance dépassé.

5. **Respect des règles** : rester cohérent avec `rules/risk_rules.md` et la charte TradeEmpire ; ne pas recommander de positions hors scope (levier, taille, symboles non éligibles).
