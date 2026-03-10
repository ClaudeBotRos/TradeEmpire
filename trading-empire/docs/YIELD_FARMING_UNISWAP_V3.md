# Yield farming Uniswap V3 — clés API et utilisation du wallet

TradeEmpire utilise **Uniswap V3** pour le yield farming (wallet principal `0x6B5Fb55d58ca32c900957d8cbdF6CdC056d64947`). Voici comment obtenir les clés / URLs nécessaires et les utiliser de façon sécurisée.

---

## 1. Wallet

- **Adresse :** `0x6B5Fb55d58ca32c900957d8cbdF6CdC056d64947`
- **Clé privée :** nécessaire uniquement pour **signer les transactions** (dépôt/retrait de liquidité). Elle **ne doit jamais** être commitée dans le code ni stockée en clair dans un fichier du dépôt.

**Méthode recommandée : variable d’environnement**

- Exporte la clé privée (sans le préfixe `0x` ou avec, selon la lib utilisée) dans une variable réservée au serveur / à la machine qui exécute les scripts :
  ```bash
  export YIELD_FARMER_PRIVATE_KEY="ta_cle_privee_hex"
  ```
- Les scripts (ex. `yield-uniswap-deposit.js`) liront `process.env.YIELD_FARMER_PRIVATE_KEY`. Ne pas utiliser cette variable dans le front ou dans des logs.

**Alternative :** keystore chiffré (fichier JSON + mot de passe) et une lib (ethers / viem) pour déverrouiller au moment de la tx. À documenter côté script si tu choisis cette option.

---

## 2. RPC (nœud Ethereum)

Pour lire la blockchain et envoyer des transactions, il faut une **URL RPC** (Ethereum mainnet, ou Arbitrum si tu utilises Uniswap V3 sur L2).

**Obtenir une clé API RPC :**

1. **Alchemy**  
   - https://www.alchemy.com/  
   - Créer une app (Ethereum mainnet ou Arbitrum).  
   - Dans le dashboard : "API key" / "HTTPS" → URL du type  
     `https://eth-mainnet.g.alchemy.com/v2/TA_CLE`

2. **Infura**  
   - https://www.infura.io/  
   - Créer un projet, activer "Ethereum" (ou Arbitrum).  
   - URL du type  
     `https://mainnet.infura.io/v3/TA_PROJECT_ID`

3. **Utilisation dans TradeEmpire**  
   - Mettre l’URL complète dans une variable d’environnement, par exemple :  
     ```bash
     export YIELD_FARMER_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/TA_CLE"
     ```
   - La config (`yield_farmer_config.json`) référence `YIELD_FARMER_RPC_URL` ; les scripts la lisent via `process.env.YIELD_FARMER_RPC_URL`.

---

## 3. Uniswap Labs API (clé créée sur Uniswap)

Pour le **yield farming** (création / modification de positions LP, approval, claim fees), on utilise l’**API Uniswap Labs** avec une clé créée sur le [Developer Portal](https://developers.uniswap.org/dashboard/). Doc : [api-docs.uniswap.org/introduction](https://api-docs.uniswap.org/introduction).

**Obtenir une clé API :** Developer Portal Uniswap → https://developers.uniswap.org/dashboard/ → créer une clé. Envoyée en header **`x-api-key`**.

**Utilisation :** Base URL `https://trade-api.gateway.uniswap.org/v1` ; endpoints LP : **POST /lp/approve**, **/lp/create**, **/lp/increase**, **/lp/decrease**, **/lp/claim**. Variable d’env : `THE_GRAPH_API_KEY_UNISWAP` ou `UNISWAP_API_KEY` dans `workspace/.env`. Vérification : `node scripts/yield-verify-connection.js`.

**Accès LP :** Si 403 sur `/lp/approve` alors que `/quote` marche, le portail n’offre pas d’option pour activer les endpoints LP. Demander l’activation à **apisupport@uniswap.org** (clé Developer Portal, besoin LP pour yield farming).

---

## 4. Résumé des variables d’environnement

| Variable | Rôle | Exemple (à ne pas commiter) |
|----------|------|-----------------------------|
| `YIELD_FARMER_PRIVATE_KEY` | Signer les txs (dépôt/retrait LP) | `0xabc...` ou `abc...` |
| `YIELD_FARMER_RPC_URL` | Accès RPC Ethereum (ou L2) | `https://eth-mainnet.g.alchemy.com/v2/...` |
| `THE_GRAPH_API_KEY_UNISWAP` ou `UNISWAP_API_KEY` | **API Uniswap Labs** (Liquidity Provisioning, swap). Clé créée sur [developers.uniswap.org/dashboard](https://developers.uniswap.org/dashboard/). Envoyée en header `x-api-key`. | Ta clé dans `workspace/.env`. |

À définir dans ton environnement (fichier `.env` à la racine du projet ou dans le répertoire TradeEmpire, avec `.env` dans `.gitignore`), ou dans le système (systemd, cron, etc.) qui lance les scripts.

**Exemple :** dans `workspace/.env` (déjà chargé par `load-workspace-env.js`) : `THE_GRAPH_API_KEY_UNISWAP=ta_cle_ici` (la même clé que celle créée sur le Developer Portal Uniswap).

---

## 5. Utilisation du yield farming (flux prévu)

1. **Lecture (sans clé privée)**  
   - Scripts qui utilisent `ARBITRUM_RPC_URL` (ou `YIELD_FARMER_RPC_URL`) et l’**API Uniswap Labs** (clé `THE_GRAPH_API_KEY_UNISWAP` / `UNISWAP_API_KEY`, header `x-api-key`) :  
     - Récupérer les pools Uniswap V3 (ex. USDC/USDT), liquidité, fees générés.  
     - Calculer / estimer l’APY et mettre à jour `yield_farmer_report.json`.

2. **Écriture (avec clé privée)**  
   - Scripts qui appellent les contrats Uniswap V3 (NonfungiblePositionManager, etc.) pour :  
     - approve des tokens,  
     - mint une position (fourniture de liquidité),  
     - ou increase/decrease liquidity / collect fees.  
   - Ces scripts lisent `YIELD_FARMER_PRIVATE_KEY` et `YIELD_FARMER_RPC_URL` ; à n’exécuter que sur un environnement de confiance (pas dans le navigateur).

3. **Wallet**  
   - Toutes les transactions sont envoyées depuis l’adresse dérivée de `YIELD_FARMER_PRIVATE_KEY` ; elle doit correspondre au wallet principal `0x6B5Fb55d58ca32c900957d8cbdF6CdC056d64947` si c’est bien ce wallet que tu veux utiliser.

---

## 6. Références

- Uniswap V3 Subgraph (exemples de requêtes) : https://docs.uniswap.org/api/subgraph/guides/v3-examples  
- The Graph – gérer les clés API : https://thegraph.com/docs/sv/subgraphs/querying/managing-api-keys/  
- Uniswap V3 – mint a position : https://docs.uniswap.org/contracts/v3/guides/providing-liquidity/mint-a-position  
- Config TradeEmpire : `data/dashboard/yield_farmer_config.json`
