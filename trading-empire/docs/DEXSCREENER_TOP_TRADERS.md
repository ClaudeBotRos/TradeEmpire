# Dexscreener Top Traders — API RapidAPI

**Documentation officielle :** [Dexscreener Top Traders sur RapidAPI](https://rapidapi.com/scrapewizard-scrapewizard-default/api/dexscreener-top-traders) (ScrapeWizard).

## Usage dans TradeEmpire (agent Smart Money / Lucas)

- **Script :** `scripts/dexscreener-top-traders.js`
- **Sortie :** `data/signals/smart_money/dexscreener_holders.json`
- **Dashboard :** vue « Smart money » → bloc « Top traders (Dexscreener) » + `GET /api/smart_money/holders`

## Authentification

- **RapidAPI** : même clé que les autres APIs (Daphnée, Alicia). Variable dans `workspace/.env` : `RAPIDAPI_KEY` (= X-RapidAPI-Key de ton app RapidAPI).
- **Hôte utilisé :** `dexscreener-top-traders.p.rapidapi.com`

## Endpoint utilisé

| Méthode | Endpoint | Paramètre requis |
|--------|----------|-------------------|
| GET | `/get_holders` | `wallet_url` (query) |

- **Format de `wallet_url` :** l’URL doit commencer par `https://dexscreener.com/` (ex. `https://dexscreener.com/solana/AW526gmdn3wvhxa4D5FngY1HH3zAyYBpCSJnkYdXyqpx`). Une adresse seule (sans préfixe) renvoie **400 Invalid URL format**.

### Plusieurs wallets (liste à surveiller)

Pour scruter **plusieurs wallets** au lieu d’un seul :

1. **Fichier (recommandé)** : créer `data/signals/smart_money/dexscreener_wallets.txt` avec **une URL Dexscreener par ligne**. Le script lit ce fichier automatiquement s’il existe (copier depuis `dexscreener_wallets.txt.example`).
2. **Variable d’environnement** : `DEXSCREENER_WALLET_URLS` dans `workspace/.env`, URLs séparées par des virgules.
3. **Un seul wallet** : `DEXSCREENER_WALLET_URL` ou argument `node scripts/dexscreener-top-traders.js <URL>`.

Où trouver des URLs de wallets à ajouter : page Dexscreener (top traders d’un token, lien « wallet »), ou outils comme [Apify — Dexscreener Top Traders Scraper](https://apify.com/crypto-scraper/dexscreener-top-traders-scraper) pour obtenir une liste. Une fois la liste dans `dexscreener_wallets.txt`, le script les interroge tous et fusionne les holders dans la sortie JSON.

## Réponses possibles

- **200** : corps JSON (souvent un tableau ou un objet avec liste de holders). Le script normalise en `holders[]` et `count`.
- **400** : paramètre manquant ou format invalide (ex. `wallet_url is required`, `Invalid URL format. Must start with https://dexscreener.com/`).
- **404** : `Failed to fetch holder data` — l’API ne renvoie pas de données pour cette URL (certaines pages Dexscreener ou certains wallets ne sont pas supportés par l’endpoint).

## Référence

- [Dexscreener Top Traders — RapidAPI (ScrapeWizard)](https://rapidapi.com/scrapewizard-scrapewizard-default/api/dexscreener-top-traders)
