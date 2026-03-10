# Rationalisation des coûts X.com vs Twttr (RapidAPI)

Objectif : **ne pas dépenser plus en API X que ce qu’on gagne**. Ce doc recense ce qu’on consomme aujourd’hui, ce que l’API Twttr (RapidAPI) peut fournir en équivalent, et les recommandations.

---

## 1. Usage actuel de l’API X.com

| Script / usage | Endpoint X | Paramètres typiques | Reads / appel | Fréquence estimée |
|----------------|------------|---------------------|---------------|-------------------|
| **intel-scan.js** (Daphnée) | `GET /2/tweets/search/recent` | query crypto/bitcoin/ethereum, max_results=50, start_time=-12h | 1 | 1×/jour (cron) |
| **sentiment-scan.js** | idem | query crypto/bitcoin/BTC, max_results=20 | 1 | 1×/jour ou plus |
| **agent-status-report.js** | idem | query crypto/bitcoin/BTC, max_results=10 (healthcheck) | 1 | 1×/exécution rapport |
| **cost-api-update.js** | `GET /2/usage/tweets` | pas de lecture de tweets | 0 | MAJ coûts |

**Total par jour** (1 intel + 1 sentiment + 1 agent-status) : **3 reads**.  
Sur un mois : ~90–150 reads selon fréquence des crons.  
Coût X : **0,005 USD par read** (lecture Post, [pricing X](https://developer.x.com/#pricing)).  
Exemple : 1 498 reads → **7,49 USD**.

---

## 2. Ce dont on a besoin (pour rationaliser)

| Besoin | Rempli par | Remplaçable par Twttr ? |
|--------|------------|--------------------------|
| **Recherche par mot-clé** (crypto, bitcoin, etc.) — tweets récents | X `tweets/search/recent` | **À vérifier** : Twttr doit exposer un endpoint “search” (voir script `twttr-api-capabilities.js`). |
| **Réponses / commentaires d’un post** (si on avait un post_id) | X (ou pas utilisé aujourd’hui) | **Oui** : Twttr `GET /comments-v2?pid=...` vérifié. |
| **Usage / quota** (suivi coût) | X `GET /2/usage/tweets` | **Non** : spécifique X, pas d’équivalent Twttr. |

Aujourd’hui **tout notre coût X** vient des **3 appels search/recent** (intel, sentiment, agent-status). On n’utilise pas les “replies” côté X.

---

## 3. Ce que l’API Twttr (RapidAPI) permet

- **Host** : `twitter241.p.rapidapi.com`  
- **Auth** : `x-rapidapi-key` (RAPIDAPI_KEY) + `x-rapidapi-host: twitter241.p.rapidapi.com`

| Endpoint Twttr | Équivalent X | Statut | Impact coût X |
|----------------|--------------|--------|----------------|
| **GET /comments-v2** (pid, rankingMode, count) | Réponses à un post | **Vérifié** (200, format Timeline) | Aucun aujourd’hui (on ne fait pas de “replies” en X). |
| **Search par query** (recherche par mot-clé) | `tweets/search/recent` | **Non vérifié** — noms d’endpoints à confirmer sur la fiche RapidAPI (ex. /search, /search-v2, /feed). | Si trouvé et stable : **remplace intel + sentiment + agent-status** → baisse forte du coût X. |
| **User tweets** (timeline utilisateur) | User timeline | À vérifier sur RapidAPI | Optionnel (pas utilisé actuellement). |

Facturation RapidAPI : forfait / quotas selon ton plan (pas au “read” comme X). À comparer au coût actuel X (ex. 7,49 USD pour ~1 500 reads).

---

## 4. Recommandations pour ne pas dépenser plus qu’on gagne

1. **Mesurer**  
   - Lancer `node scripts/twttr-api-capabilities.js` (et éventuellement `twttr-rapidapi-test.js`) pour lister ce que Twttr renvoie vraiment (search, comments, user).  
   - Garder `cost-api-update.js` + dashboard pour suivre **X** et **OpenRouter** ; ajouter RapidAPI dans `costs.json` si tu factures au forfait.

2. **Réduire la consommation X tant qu’on n’a pas de search Twttr**  
   - Réduire `max_results` si suffisant (ex. 50 → 30 pour intel, 20 → 15 pour sentiment).  
   - Éviter d’exécuter agent-status trop souvent (ex. 1×/jour au lieu de chaque rapport).  
   - Regrouper : un seul “search recent” partagé entre intel et sentiment (cache 5–15 min) si l’architecture le permet.

3. **Basculer le search sur Twttr dès qu’un endpoint search est confirmé**  
   - Adapter intel-scan, sentiment-scan et agent-status pour appeler Twttr au lieu de X quand `RAPIDAPI_KEY` est défini.  
   - Garder X en fallback ou pour l’Usage API uniquement (suivi coût).

4. **Utiliser Twttr pour les réponses à un post**  
   - Si on ajoute une feature “réponses à un tweet” (ex. enrichir une trend card), utiliser **uniquement** Twttr `/comments-v2` pour ne pas consommer de reads X.

5. **Seuil de rentabilité**  
   - Noter dans le dashboard ou dans ce doc : objectif “coûts API &lt; gains” (ex. total API &lt; PnL ou &lt; X % du PnL).  
   - Alerter (ou réduire fréquence) si le coût X dépasse ce seuil.

---

## 5. Fichiers utiles

| Fichier | Rôle |
|---------|------|
| `docs/TWITTER_RAPIDAPI_VS_X.md` | Comparatif détaillé X vs Twttr (endpoints, auth, limites). |
| `scripts/twttr-rapidapi-test.js` | Test minimal Twttr (comments-v2 + essais search). |
| `scripts/twttr-api-capabilities.js` | Rapport “ce qu’on peut récupérer” via Twttr (pour rationalisation). |
| `scripts/cost-api-update.js` | MAJ `costs.json` (X usage, OpenRouter, etc.). |
| `data/dashboard/costs.json` | Coûts API + balance (gains − coûts). |

---

## 6. Résumé

- **Aujourd’hui** : tout le coût X vient de **search/recent** (intel + sentiment + agent-status). Pas de “replies” X.
- **Twttr** : **comments-v2** OK ; **search** à confirmer (fiche RapidAPI + script capabilities).
- **Pour rationnaliser** : (1) vérifier search Twttr et basculer si possible ; (2) sinon réduire fréquence / max_results côté X ; (3) suivre balance coûts vs gains dans le dashboard.
