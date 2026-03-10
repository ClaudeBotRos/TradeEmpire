# Plan détaillé — Yield Farmer (agent TradeEmpire)

**Objectif** : faire fructifier le capital dormant (USDT / stablecoins) via **Uniswap V3** (paires stables USDC/USDT) avec un objectif de **5–15 % APY**, sans bloquer la trésorerie du trading.

---

## 0. Wallet, plateforme, actif (paire)

À ce stade **aucun wallet ni plateforme n’est configuré**. Voici les choix possibles et une recommandation.

| Élément | Options | Recommandation |
|--------|---------|----------------|
| **Wallet** | **(1)** Compte Binance (même que ASTER) — pas de wallet externe. **(2)** MetaMask (ou autre) sur L2 pour DeFi. | **Phase 1–3 :** utiliser le **compte Binance** (Earn) = même écosystème que le trading, pas de transfert. **Phase 4 (DeFi) :** wallet dédié (ex. MetaMask sur Arbitrum) si tu veux Aave/Compound. |
| **Plateforme** | **(1)** **Binance Earn** (Flexible / Locked) — USDT sur le spot Binance, APY typique 2–8 %. **(2)** **DeFi** : Aave v3 (Arbitrum, Polygon, Base), Compound (Base), Curve (Ethereum ou L2). | **Recommandé pour démarrer :** **Binance Earn — USDT Flexible Savings** (même compte que le futures, retrait instantané vers le futures si besoin). Ensuite, option DeFi sur **Arbitrum** ou **Base** (gas faible) si tu configures un wallet. |
| **Actif (pas de « paire » en yield)** | Un seul actif : **USDT**, **USDC** ou **DAI**. | **USDT** — aligné avec ASTER (marge en USDT) et Binance Earn ; pas de change. |

**Résumé recommandé :**

- **Wallet :** compte Binance (spot) déjà utilisé pour le dépôt futures.
- **Plateforme :** Binance Earn → produit **USDT Flexible Savings** (ou USDT Locked pour APY plus haut si tu acceptes le blocage).
- **Actif :** **USDT** uniquement.

La config utilisée par l’agent (pour le rapport et les recos) est dans `data/dashboard/yield_farmer_config.json` : tu peux y fixer `platform`, `asset`, `wallet_type` quand tu as choisi.

---

## 1. Périmètre et hypothèses

| Élément | Valeur / règle |
|--------|------------------|
| **Capital cible alloué** | 50–70 % du disponible « dormant » (hors marge réservée trading) — ex. ~50–80 USDT en phase 1 |
| **Actifs** | Stablecoins uniquement : USDT, USDC, DAI (pools 100 % stables ou lending) |
| **APY cible** | 5–15 % (seuil minimum 5 % ; alerte si sous 5 %) |
| **Risque accepté** | Smart contract (protocoles majeurs), pas de risque de change ; pas d’impermanent loss (pools stables) |
| **Fréquence** | Scan / rapport quotidien ; recommandations d’allocation selon opportunité |

---

## 2. Phases d’implémentation

### Phase 1 — Monitoring et rapport (actuelle)

**Actions :**

1. **Rapport quotidien**  
   - L’agent lit `executor_balance.json` / `tibo_report.json` pour le capital disponible.  
   - Il produit ou met à jour `data/dashboard/yield_farmer_report.json` avec :  
     - `capital_dormant_estime_usdt` (part non utilisée par le trading),  
     - `recommandation_allocation_usdt`,  
     - `pools_cibles` (liste type Aave USDT, Compound USDC, Curve 3pool avec APY indicatifs si source disponible),  
     - `alertes` (ex. « APY < 5 % » si une source est branchée).

2. **Scripts**  
   - `scripts/yield-report.js` : agrège solde disponible, lit la config Uniswap V3 (wallet, paire), écrit le rapport JSON.  
   - Phase 2 : `scripts/yield-scan.js` (ou module uniswap-v3) qui interroge le **subgraph The Graph** (clé `THE_GRAPH_API_KEY`) pour les pools Uniswap V3 et APY réels. Voir `docs/YIELD_FARMING_UNISWAP_V3.md`.

3. **Cron suggéré**  
   - Un passage par jour (ex. 08:00 ou 22:00 Europe/Paris) pour mettre à jour le rapport et notifier le BOSS si besoin.

**Rendement attendu phase 1 :** 0 % (pas d’allocation réelle ; préparation et visibilité).

---

### Phase 2 — Intégration APIs DeFi (APY réels)

**Actions :**

1. **Sources de données**  
   - Intégrer au moins une source d’APY :  
     - DeFiLlama (API publique) pour APY par protocole/pool, ou  
     - Aave/Compound/Curve subgraph ou API officielle.  
   - Stocker dans le rapport : `pools[]` avec `protocol`, `pool_id`, `apy_current`, `tvl_usd`, `updated_at`.

2. **Règles de recommandation**  
   - Trier les pools stables par APY (décroissant).  
   - Exclure les pools avec APY < 5 % ou TVL trop faible (ex. < 1 M$).  
   - Proposer 1–3 pools avec allocation suggérée (ex. 70 % sur le meilleur APY stable, 30 % sur un second pour diversification).

3. **Alertes**  
   - Si un pool « en place » (simulé ou réel) a APY < 5 % : alerte dans le rapport + optionnel WhatsApp.

**Rendement attendu phase 2 :** toujours 0 % en termes de cash (pas d’exécution), mais **chiffres réalistes** pour estimer le potentiel (ex. 8 % APY sur 70 USDT ≈ 5,6 USDT/an ≈ 0,45 USDT/mois).

---

### Phase 3 — Allocation manuelle guidée

**Actions :**

1. **Recommandations exécutables**  
   - Le rapport contient des instructions claires : « Déposer X USDT sur Aave (marché USDT) » avec lien ou étapes.  
   - L’utilisateur exécute manuellement sur le protocole.

2. **Suivi**  
   - L’utilisateur (ou un script manuel) peut renseigner dans le rapport : `capital_alloue_usdt`, `pool_actuel`, `apy_estime`, `date_depot`.  
   - Calcul du rendement attendu : `rendement_annuel_estime = capital_alloue * (apy_estime / 100)`.

3. **Rapport BOSS**  
   - Inclure dans le contexte BOSS (vision/nuit) un résumé Yield Farmer : capital alloué, APY moyen, rendement estimé sur le mois.

**Rendement attendu phase 3 :**  
- Hypothèse : 70 USDT alloués, APY moyen 8 %.  
- **Rendement annuel estimé : 5,6 USDT.**  
- **Rendement mensuel estimé : ~0,47 USDT.**  
- En phase de test (mois 1–2), viser plutôt **2–4 USDT de gain sur l’année** (capital plus faible ou APY conservateur 5–6 %).

---

### Phase 4 — Automatisation (optionnel, ultérieur)

**Actions :**

1. **Connexion wallet / protocole**  
   - Intégration avec un wallet (ex. clé dédiée) et appels aux contrats Aave/Compound (dépôt/retrait) ou utilisation d’un agrégateur (Zapper, etc.).  
   - Validation utilisateur obligatoire (plafond max, whitelist de protocoles).

2. **Auto-compound**  
   - Script ou cron qui déclenche le « compound » (réinvestir les intérêts) selon la fréquence du protocole (quotidien/hebdo).

3. **Sécurité**  
   - Plafond d’allocation (ex. max 100 USDT), uniquement protocoles listés (Aave, Compound, Curve), pas de retrait automatique sans seuil ou alerte.

**Rendement attendu phase 4 :**  
- Même base que phase 3 ; gain supplémentaire possible par compound (ordre de grandeur +5–15 % sur le rendement annuel selon fréquence).

---

## 3. Synthèse des rendements attendus

| Phase | Capital typique | APY hypothétique | Rendement annuel estimé | Rendement mensuel estimé |
|-------|------------------|-------------------|--------------------------|---------------------------|
| 1 | 0 (prep) | — | 0 USDT | 0 USDT |
| 2 | 0 (monitoring) | 5–15 % (données réelles) | 0 USDT | 0 USDT |
| 3 | 50–80 USDT | 6–10 % | 3–8 USDT | 0,25–0,67 USDT |
| 4 | 50–100 USDT | 6–10 % + compound | 3,5–9 USDT | 0,3–0,75 USDT |

*Les montants sont indicatifs ; ils dépendent du capital effectivement alloué et des APY réels des pools.*

---

## 4. Fichiers et crons

| Fichier / ressource | Rôle |
|---------------------|------|
| `agents/yield_farmer/soul.md`, `tasks.md`, `tools.md` | Définition de l’agent (déjà créés). |
| `data/dashboard/yield_farmer_report.json` | Rapport de l’agent (capital, pools, APY, alertes, recommandations). |
| `scripts/yield-report.js` | Synthèse quotidienne (à créer en phase 1). |
| `data/dashboard/yield_farmer_config.json` | Wallet 0x6B5F..., plateforme Uniswap V3, paire USDC/USDT, variables d'env (RPC, The Graph, clé privée). |
| `docs/YIELD_FARMING_UNISWAP_V3.md` | Méthode pour obtenir les clés API (The Graph, RPC) et utiliser le wallet. |
| `scripts/yield-scan.js` | Scan APY (phase 2 : subgraph The Graph). |
| Cron OpenClaw | Ex. 1×/jour `tradeempire-yield-farmer` (agent `yield_farmer`). |

---

## 5. Prochaines étapes immédiates

1. **Créer** `data/dashboard/yield_farmer_report.json` avec structure minimale (timestamp, capital_dormant_estime, pools_cibles, alertes).  
2. **Créer** `scripts/yield-report.js` : lit balance disponible (executor_balance / tibo_report), écrit le rapport avec recommandation d’allocation (texte/indicative).  
3. **Ajouter** un job cron OpenClaw pour l’agent `yield_farmer` (une fois le script en place).  
4. **Phase 2** : brancher une API APY (subgraph Uniswap V3, THE_GRAPH_API_KEY) dans `yield-scan.js` ; voir `docs/YIELD_FARMING_UNISWAP_V3.md`

Ce document peut être mis à jour au fil des phases (dates de déploiement, rendements réels observés).
