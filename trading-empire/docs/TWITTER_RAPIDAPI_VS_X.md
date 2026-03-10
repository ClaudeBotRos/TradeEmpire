# Twttr API (RapidAPI) vs API X.com officielle

Comparaison pour TradeEmpire : ce qu’on utilise avec X.com et ce que l’API **Twttr API** (twitter241.p.rapidapi.com) sur RapidAPI peut fournir en équivalent.

## Ce qu’on utilise avec l’API X officielle

| Besoin | Endpoint X | Scripts |
|--------|------------|--------|
| **Recherche recent (crypto/bitcoin)** | `GET https://api.twitter.com/2/tweets/search/recent?query=...&max_results=50&start_time=...&tweet.fields=created_at,text` | intel-scan.js, sentiment-scan.js, agent-status-report.js |
| **Usage / coût** | `GET https://api.x.com/2/usage/tweets?days=30` | cost-api-update.js |

Auth : **Bearer** `X_BEARER_TOKEN` (App-only).

---

## Ce que propose Twttr API (RapidAPI)

- **Host** : `twitter241.p.rapidapi.com`
- **Auth** : headers `x-rapidapi-key` (ta `RAPIDAPI_KEY`) et `x-rapidapi-host: twitter241.p.rapidapi.com`

D’après la doc et les discussions RapidAPI, l’API Twttr propose notamment :

| Équivalent X | Twttr API (RapidAPI) | Équivalence |
|--------------|----------------------|-------------|
| **Commentaires / réponses à un post** | `GET /comments-v2?pid=<post_id>&rankingMode=Relevance&count=20` | Oui — équivalent “replies” X. |
| **Recherche par mot-clé** | Endpoint “search” (à vérifier sur la page RapidAPI : nom exact et paramètres). | À tester — équivalent partiel à search/recent si disponible. |
| **Tweets d’un utilisateur** | “Fetch User Tweets” (nom exact à vérifier). | Partiel — équivalent timeline utilisateur. |
| **Usage / coût** | Aucun — facturation RapidAPI (quota/plan). | Non — pas d’équivalent à l’Usage API X. |

Limites signalées sur les forums : erreurs d’auth, données parfois inexactes, problèmes sur le search. À valider avec des appels réels.

**Test effectué** : `GET /comments-v2?pid=...&rankingMode=Relevance&count=5` → **200 OK** (réponse avec cursor / pagination). Les commentaires/réponses à un post sont donc utilisables avec Twttr. Pour un équivalent à la **recherche par mot-clé** (search recent), il faut consulter la fiche RapidAPI (onglet Endpoints) pour le nom exact de l’endpoint search.

---

## Test rapide (Twttr API)

Depuis `trading-empire/` :

```bash
node scripts/twttr-rapidapi-test.js
```

Le script utilise `RAPIDAPI_KEY` et `x-rapidapi-host: twitter241.p.rapidapi.com` pour appeler :
1. **Comments** : `GET /comments-v2` (ex. un `pid` connu) pour vérifier que l’API répond.
2. **Search** : si un endpoint search est documenté sur la fiche RapidAPI, un second appel pourra être ajouté pour comparer avec notre usage “search recent” X.

---

## Recommandation

- **Commentaires / réponses** : Twttr API peut remplacer l’usage “replies” X si on a un ID de post (ex. pour enrichir une Trend Card avec les réponses).
- **Recherche par query (crypto, bitcoin, etc.)** : garder l’API X officielle (`tweets/search/recent`) tant qu’on n’a pas vérifié un endpoint search Twttr et sa stabilité.
- **Coûts** : X reste suivi via l’Usage API et le calcul 0,005 $/lecture ; RapidAPI = coût fixe/quotas du plan, à suivre à part (ex. dans costs.json si besoin).

Après exécution du script de test, on pourra mettre à jour ce doc avec les vrais noms d’endpoints et exemples de réponses (search, user tweets) pour décider quoi basculer sur Twttr.

---

## Rationalisation des coûts

Voir **docs/RATIONNALISATION_COUTS_X_TWITTER.md** pour : ce qu'on consomme en X, ce que Twttr peut fournir, comment ne pas dépenser plus qu'on gagne.

Rapport des capacités Twttr (ce qu'on peut récupérer) :

```bash
node scripts/twttr-api-capabilities.js
```
