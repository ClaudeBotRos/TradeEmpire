# Hyperliquid — Actifs tokenisés (or, pétrole, matières premières)

TradeEmpire étend son activité aux **actifs tokenisés** proposés par Hyperliquid : or (XAU/GOLD), pétrole (OIL/BRENT) et autres matières premières. Un agent dédié, **Eva (Hyperliquid Analyst)**, analyse les tendances et les données spécialisées pour recommander les meilleures positions.

## Connexion (déjà en place)

- **API publique** : `https://api.hyperliquid.xyz/info` (POST, JSON body).
- **Endpoints utiles** :
  - `{ "type": "perpDexs" }` — liste de tous les perp DEX (main + **HIP-3** builder-deployed).
  - `{ "type": "allPerpMetas" }` — métadonnées (universe) de **tous** les perp DEX en un appel (main + HIP-3).
  - `{ "type": "meta", "dex": "" }` — meta du main dex ; `"dex": "xyz"` pour un DEX HIP-3.
  - `{ "type": "metaAndAssetCtxs", "dex": "" }` — meta + contextes (mark price, funding, OI, volume).
  - `{ "type": "leadingVaults" }` ou `{ "type": "vaultSummaries" }` — top vaults (Smart Money).
- **HIP-3** (Builder-Deployed Perpetuals) : or, pétrole, matières premières, actions (TSLA, GOLD, etc.) sont listés via `perpDexs` + `allPerpMetas`. Les symboles HIP-3 ont le préfixe du DEX (ex. `xyz:GOLD`, `flx:OIL`).
- **Connexion signée** (si ordres / user info) : variables `HYPERLIQUID_WALLET` et `HYPERLIQUID_SECRET` dans `workspace/.env`. Voir `docs/API_KEYS.md`.

## Agent Eva (Hyperliquid Analyst)

- **Rôle** : analyser tendances et infos spécialisées pour placer les meilleures positions sur les actifs tokenisés HL.
- **Définition** : `agents/hyperliquid_analyst/soul.md`, `tasks.md`, `tools.md`.
- **Scripts** :
  - `scripts/hyperliquid-commodities-scan.js` — appelle `perpDexs` et `allPerpMetas` pour récupérer **tous les perp (main + HIP-3)** ; filtre actifs tokenisés (or, pétrole, matières premières, actions) ; écrit `data/hyperliquid/commodities_meta.json` et `data/hyperliquid/hip3_dexes.json`. Testé : 8 DEX HIP-3, 138 actifs (xyz:GOLD, xyz:SILVER, xyz:BRENTOIL, flx:OIL, etc.).
  - `scripts/fetch-hyperliquid-top.js` — leading vaults (existant).
- **Rapport** : `data/dashboard/hyperliquid_analyst_report.json` (timestamp_utc, symbols_analyzed, recommendations[], summary). Consommé par le BOSS et le dashboard.
- **Cron** : `tradeempire-hyperliquid-analyst` (09:30 Europe/Paris).

## Symboles ciblés (filtre)

Le scan filtre les symboles dont le nom correspond à des commodités, par ex. : XAU, GOLD, OIL, BRENT, WTI, SILVER, COPPER, NATURAL GAS, etc. La liste exacte dépend de l’universe renvoyé par l’API `meta`. Fichier généré : `data/hyperliquid/commodities_meta.json`.

## Workflow

1. **Eva (Hyperliquid Analyst)** (cron 09:30) : scan commodities → lecture intel + techniques → rédaction du rapport avec recommandations.
2. **BOSS / Orchestrator** : lit le rapport et peut intégrer les idées dans les décisions ou le brief.
3. **Exécution** : les ordres sur Hyperliquid (si activés) passent par le flux décisions → validation → executor ; l’agent ne place pas d’ordres lui-même.
