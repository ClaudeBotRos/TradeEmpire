# Meilleurs pools Uniswap V3 sur Arbitrum

Source : **DeFiLlama** (API publique `https://yields.llama.fi/pools`).  
Mise à jour : lancer `node scripts/yield-fetch-pools-arbitrum.js` depuis la racine du projet trading-empire.  
Résultat écrit dans `data/dashboard/uniswap_v3_arbitrum_pools.json`.

---

## Top par TVL (liquidité)

| Paire       | TVL (approx) | APY (indicatif) | Risque IL |
|------------|--------------|------------------|-----------|
| WBTC-WETH  | ~56 M$       | ~25 %            | oui       |
| WETH-USDC  | ~47 M$       | ~54 %            | oui       |
| WETH-USDT  | ~13 M$       | ~49 %            | oui       |
| WBTC-USDT  | ~12 M$       | ~60 %            | oui       |
| WBTC-USDC  | ~7 M$        | variable         | oui       |
| WETH-USDC  | ~6 M$        | ~31 %            | oui       |
| WETH-GMX   | ~5 M$        | ~15 %            | oui       |
| USDC-USDT  | ~2,5 M$      | ~2 %             | **non**   |

Paires avec **risque d’impermanent loss** : réserver aux positions conscientes du risque (ETH/BTC vs stables).

---

## Pools stablecoin (faible IL) — pour Gary (Yield Farmer)

Pour un objectif « capital stable + rendement modéré », privilégier les paires **stablecoin vs stablecoin** :

| Paire        | TVL (approx) | APY (indicatif) | Risque IL |
|-------------|--------------|-----------------|-----------|
| **USDC-USDT** | ~2,5 M$     | ~2 %            | **non**   |
| USDC-DAI     | ~150 k$      | ~4,6 %          | non       |
| DAI-USDT     | ~222 k$      | ~5 %            | non       |
| USDC.E-USDC  | ~104 k$      | ~1,5 %          | non       |

**Recommandation TradeEmpire** : **USDC/USDT** sur Arbitrum — meilleur compromis TVL / liquidité / risque pour le wallet configuré (voir `yield_farmer_config.json`).

---

## Pools « no IL » (corrélés) — APY plus élevés

DeFiLlama classe certains pools en `ilRisk: no` (ex. ETH/staked-ETH). Exemples (APY indicatifs, TVL plus faibles) :

- ETHFI-WETH, EZETH-WETH, WEETH-WETH, WSTETH-WETH  
- WBTC-CBBTC, WBTC-TBTC, WBTC-RBTC  

À utiliser seulement si tu acceptes le risque smart-contract / dépeg des wrappers.

---

## Récap

- **Volume / liquidité** : WETH-USDC, WBTC-WETH, WETH-USDT en tête.
- **Stablecoin, risque minimal** : **USDC-USDT** (TVL ~2,5 M$, APY ~2 %).
- Données détaillées et à jour : `data/dashboard/uniswap_v3_arbitrum_pools.json` après exécution de `yield-fetch-pools-arbitrum.js`.
