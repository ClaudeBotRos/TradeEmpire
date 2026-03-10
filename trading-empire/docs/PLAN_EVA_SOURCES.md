# Plan : enrichir les sources d’Eva (Hyperliquid Analyst)

Eva produit aujourd’hui ses recommandations à partir **uniquement** de l’API Hyperliquid et de `commodities_meta.json`. Ce plan décrit comment lui donner plus de contexte (news, intel, macro) en s’inspirant des flux RSS et du rôle de Parvati.

---

## 1. État actuel des sources d’Eva

| Source | Fichier / API | Utilisation réelle |
|--------|----------------|---------------------|
| **Hyperliquid API** | `perpDexs`, `allPerpMetas`, `metaAndAssetCtxs` | Via `hyperliquid-commodities-scan.js` → `commodities_meta.json` |
| **commodities_meta.json** | Mark, OI, funding par actif tokenisé | Lecture par `hyperliquid-analyst-trend.js` ; base des recommandations |
| **hip3_dexes.json** | Liste DEX HIP-3 | Résumé (main vs HIP-3) |
| **trend_cards.json** (Intel) | Mentionné dans tools/tasks | **Non lu** par le script actuel |
| **economic_calendar** | Mentionné dans tools | **Non lu** |

---

## 2. Objectif

Enrichir le **contexte** d’Eva pour que ses recommandations (or, pétrole, matières premières, actions tokenisées) tiennent compte de :

- **Actualités / catalysts** (comme les RSS de Parvati) : or, pétrole, géopolitique, crypto, macro.
- **Tendances Intel** : X, YouTube, macro (trend_cards).
- **Calendrier économique** : événements (Fed, NFP, CPI) qui impactent or / dollar / commodities.
- **Optionnel** : signaux techniques sur actifs corrélés (ex. XAU si disponible).

---

## 3. Nouvelles sources à brancher (inspirées de Parvati)

### 3.1 Parvati — News / catalysts (priorité haute)

- **Fichier** : `data/dashboard/intel/news_scan_report.json`
- **Contenu utile** : `catalysts[]` (titres agrégés RSS : CoinDesk, Cointelegraph, Decrypt, CryptoSlate, etc.), `rss_aggregate` (items avec `source`, `title`, `url`).
- **Intérêt pour Eva** :  
  - Titres contenant "oil", "gold", "petrol", "dollar", "Fed", "Iran", "geopolitical" → impact or / pétrole / HL.  
  - Ex. : *"Bitcoin climbs as dollar, oil weaken after Trump comments on Iran"* → contexte pour OIL/GOLD tokenisés.  
  - Ex. : *"Hyperliquid's tokenized futures hit $1.2B as traders bet on oil, stocks"* → direct pour Eva.
- **Usage** : lecture dans `hyperliquid-analyst-trend.js` ; ajout d’un bloc `context_news` ou `catalysts_summary` dans le rapport (et optionnellement dans chaque recommandation en `data_sources`).

### 3.2 Intel — Trend cards (priorité haute)

- **Fichier** : `data/dashboard/intel/trend_cards.json`
- **Contenu utile** : `situation_summary`, `situation_by_source` (x, youtube, macro, cryptodaily, reddit), `cards[]` (source, title, summary).
- **Intérêt pour Eva** :  
  - Sentiment X (bullish/bearish), thèmes (régulation, ETF).  
  - Macro : "pas d’événement" vs "Fed / NFP / CPI aujourd’hui".  
  - Résumés courts pour justifier "contexte risk-on/risk-off" ou "pas de catalyseur macro majeur".
- **Usage** : lecture dans le script ; champ `context_intel` dans le rapport (résumé court + thèmes).

### 3.3 Calendrier économique (priorité moyenne)

- **Fichier** : `data/dashboard/intel/economic_calendar.json`
- **Contenu utile** : événements du jour / à venir (heure, pays, libellé, importance, actual vs forecast).
- **Intérêt pour Eva** :  
  - Fed, NFP, CPI, PMI → impact dollar, or, taux → pertinent pour GOLD, indices, parfois pétrole.
- **Usage** : lecture ; champ `context_macro` (ex. "Aujourd’hui : NFP 14h30 UTC") dans le rapport.

### 3.4 Optionnel — Flux RSS ciblés "commodities / or / pétrole"

- **Idée** : comme Parvati a une liste de flux RSS dans `news_rss_feeds.json`, on peut ajouter une **liste optionnelle** de flux orientés or / pétrole / macro (ex. Reuters Commodities, Bloomberg Energy) dans un config dédié Eva.
- **Fichier possible** : `dashboard/config/hyperliquid_analyst_sources.json` avec `rss_feeds: [ { name, url } ]` pour Eva uniquement.
- **Priorité** : basse dans un premier temps (les catalysts Parvati couvrent déjà CoinDesk, etc. qui parlent or/oil).

---

## 3.5 Sources pertinentes pour les actifs HIP-3 (monde réel)

Les actifs HIP-3 suivis par Eva sont des **actifs du monde réel tokenisés** : or (XAU/GOLD), pétrole (OIL/BRENT/WTI), métaux (silver, copper), gaz, **actions** (TSLA, AAPL, etc.). Pour les aiguiller, des sources dédiées à ces sous-jacents sont plus pertinentes que la seule crypto-news.

### Or / métaux précieux (GOLD, XAU, SILVER, etc.)

| Source | URL / type | Intérêt |
|--------|------------|--------|
| **Kitco News** | `https://www.kitco.com/news/category/news/rss` | Or, argent, métaux, mining ; très aligné avec xyz:GOLD, xyz:SILVER. |
| **BullionVault** (si RSS dispo) | — | Or physique, tendance retail. |
| Parvati (CoinDesk, etc.) | Déjà dans `news_scan_report` | Filtre "gold", "Fed", "dollar" → suffit en complément. |

### Pétrole / énergie (OIL, BRENT, WTI, GAS)

| Source | URL / type | Intérêt |
|--------|------------|--------|
| **Reuters Commodities** | Section markets/commodities ; RSS si disponible (Reuters Best, secteur Commodities & Energy). | Brent, WTI, OPEC, géopolitique pétrole. |
| **Oilprice.com** (si RSS) | — | Prix pétrole, gaz, énergie. |
| Parvati | `news_scan_report` | Filtre "oil", "Iran", "OPEC", "gas" → bon complément. |

### Actions (TSLA, AAPL, etc. tokenisées HIP-3)

| Source | URL / type | Intérêt |
|--------|------------|--------|
| **Yahoo Finance** | `https://finance.yahoo.com/rss/` (général) ou `https://finance.yahoo.com/rss/headline?s=TSLA` (par ticker). | Actualités par titre (TSLA, AAPL) ; earnings, analystes, marché. |
| **MarketWatch / Reuters Business** | RSS marchés / secteurs | Contexte macro-actions. |

### Macro / dollar (impact or, commodities, risk)

| Source | Déjà prévu | Intérêt |
|--------|------------|--------|
| **Calendrier économique** | `economic_calendar.json` | Fed, NFP, CPI, PMI → dollar, or, taux. |
| **Parvati** | Filtre "dollar", "Fed", "rates" | Titres macro déjà dans les catalysts. |

### Proposition : config Eva dédiée HIP-3

Créer **`dashboard/config/hyperliquid_analyst_sources.json`** (ou étendre une config existante) avec :

- **`hip3_rss_feeds`** : flux RSS ciblés monde réel, par catégorie :
  - `precious_metals` : [ { "name": "Kitco News", "url": "https://www.kitco.com/news/category/news/rss" } ]
  - `energy` : [ ] (à compléter si on trouve un RSS oil/gaz fiable)
  - `equities` : [ { "name": "Yahoo Finance", "url": "https://finance.yahoo.com/rss/" } ] ou par ticker si on liste les symboles HIP-3 actions (TSLA, AAPL, …)
- **`keywords_by_asset`** (optionnel) : pour filtrer les catalysts Parvati par type d’actif (ex. gold → ["gold", "XAU", "Fed", "dollar"], oil → ["oil", "Brent", "WTI", "OPEC", "Iran"]).

**Implémenté** : le script **`hyperliquid-analyst-trend.js`** fait désormais tout cela. Il charge Parvati, Intel, calendrier macro et RSS HIP-3 (config `hyperliquid_analyst_sources.json`), et remplit `context_news`, `context_intel`, `context_macro`, `context_hip3_news` dans le rapport. Le cron Eva exécute ce script avant que l’agent ne lise et affine les recommandations.

Eva (ou un script **`hyperliquid-analyst-context.js`** exécuté avant `hyperliquid-analyst-trend.js`) pourrait :

1. Lire **Parvati** (`news_scan_report.json`) + filtrer par mots-clés or/oil/equities/macro → `context_news`.
2. Lire **config HIP-3** ; si `hip3_rss_feeds` est non vide, fetcher ces flux (comme le fait Parvati pour ses RSS), les parser et les ajouter au rapport dans **`context_hip3_news`** (ex. `{ "precious_metals": [...], "equities": [...] }`).
3. Ainsi Eva dispose à la fois du contexte crypto/news général (Parvati) et de **sources pertinentes liées aux actions et matières premières du monde réel** pour aiguiller ses recommandations HIP-3.

---

## 4. Structure proposée du rapport Eva

Ajouter au rapport `hyperliquid_analyst_report.json` des champs de contexte lus par le script (et plus tard par l’agent LLM) :

```json
{
  "timestamp_utc": "...",
  "source": "hyperliquid_analyst_trend",
  "symbols_analyzed": 42,
  "recommendations": [ ... ],
  "summary": "...",

  "context_news": {
    "source_file": "intel/news_scan_report.json",
    "catalysts_count": 26,
    "summary": "Catalysts récents (Parvati) : [extrait titres liés or/oil/macro]",
    "relevant_titles": [ "Bitcoin climbs as dollar, oil weaken...", "Hyperliquid tokenized futures $1.2B..." ]
  },
  "context_intel": {
    "source_file": "intel/trend_cards.json",
    "situation_summary": "X : bullish, régulation. Macro : pas d’événement du jour.",
    "themes": [ "bullish", "régulation" ]
  },
  "context_macro": {
    "source_file": "intel/economic_calendar.json",
    "today_events": [ ... ],
    "summary": "Aujourd’hui : NFP 14h30 UTC."
  },
  "context_hip3_news": {
    "source": "hip3_rss_feeds (config Eva)",
    "precious_metals": [ { "title": "...", "url": "...", "source": "Kitco" } ],
    "equities": [ { "title": "...", "url": "...", "source": "Yahoo Finance" } ],
    "energy": [ ]
  }
}
```

- **context_news** : rempli à partir de `news_scan_report.json` (catalysts Parvati + filtre or/oil/macro).
- **context_intel** : rempli à partir de `trend_cards.json` (situation_summary + thèmes).
- **context_macro** : rempli à partir de `economic_calendar.json` (événements du jour).
- **context_hip3_news** : rempli à partir des flux RSS dédiés HIP-3 (Kitco or/métaux, Yahoo Finance actions, etc.) définis dans `hyperliquid_analyst_sources.json`.

Les recommandations existantes peuvent garder `data_sources` et ajouter par ex. `"news_scan_report"`, `"trend_cards"`, `"economic_calendar"` quand le contexte est utilisé.

---

## 5. Ordre d’exécution et dépendances

Pour que Eva ait toujours les fichiers à jour :

1. **Parvati** (news_scan) : déjà toutes les heures + dans run-morning → `news_scan_report.json` à jour.
2. **Intel** (intel-scan) : run-morning → `trend_cards.json`, `economic_calendar.json` (si economic-calendar-scan avant).
3. **Eva** :  
   - Cron actuel (ex. 09:30) : après le run-morning du matin, donc Intel et Parvati ont déjà tourné.  
   - Si on ajoute un passage Eva en journée : s’assurer que Parvati a bien tourné (toutes les heures) pour avoir des catalysts récents.

Aucun changement obligatoire de cron : le matin, run-morning fait Intel puis Parvati (news-scan) puis … ; le cron Eva 09:30 peut rester après. Pour un passage Eva en fin d’après-midi, les fichiers Intel/Parvati seront déjà là (Parvati horaire).

---

## 6. Étapes d’implémentation

| # | Tâche | Détail |
|---|--------|--------|
| 1 | Lecture `news_scan_report.json` dans `hyperliquid-analyst-trend.js` | Si le fichier existe : lire `catalysts` et/ou `rss_aggregate` ; extraire les titres contenant des mots-clés (gold, oil, petrol, dollar, Fed, Iran, macro, Hyperliquid, tokenized) ; remplir `context_news` (summary + relevant_titles). |
| 2 | Lecture `trend_cards.json` | Si le fichier existe : lire `situation_summary` et `situation_by_source` ; remplir `context_intel`. |
| 3 | Lecture `economic_calendar.json` | Si le fichier existe : lire les événements du jour ; remplir `context_macro`. |
| 4 | Enrichissement du rapport JSON | Ajouter `context_news`, `context_intel`, `context_macro` au rapport écrit ; garder rétrocompat (champs optionnels). |
| 5 | (Optionnel) Mise à jour des recommandations | Pour chaque recommandation, ajouter dans `data_sources` les fichiers utilisés (ex. `news_scan_report.json`, `trend_cards.json`) quand le contexte est disponible. |
| 6 | Config Eva HIP-3 | Créer `dashboard/config/hyperliquid_analyst_sources.json` avec `hip3_rss_feeds` (precious_metals: Kitco, equities: Yahoo Finance) et optionnellement `keywords_by_asset` pour filtrer Parvati. |
| 7 | (Optionnel) Script contexte HIP-3 | Si config `hip3_rss_feeds` non vide : fetcher et parser ces RSS (comme Parvati), remplir `context_hip3_news` dans le rapport (precious_metals, equities, energy). Peut être intégré dans `hyperliquid-analyst-trend.js` ou script dédié `hyperliquid-analyst-context.js` appelé avant. |
| 8 | Doc et tests | Mettre à jour `agents/hyperliquid_analyst/tools.md` et `tasks.md` pour lister les nouvelles sources (dont HIP-3) ; vérifier que le cron Eva tourne après Intel/Parvati. |

---

## 7. Résumé

- **Oui**, on peut s’inspirer des RSS de Parvati : utiliser **directement** `news_scan_report.json` (catalysts + rss_aggregate) comme source d’infos pour Eva, sans dupliquer les flux RSS.
- En plus : **trend_cards.json** (Intel) et **economic_calendar.json** (macro) pour un contexte tendances + calendrier.
- Implémentation : lecture de ces 3 fichiers dans `hyperliquid-analyst-trend.js`, remplissage de `context_news`, `context_intel`, `context_macro` dans le rapport, sans casser l’existant.
- **Sources HIP-3** : or/métaux (Kitco), actions (Yahoo Finance), pétrole (Reuters/Oilprice). Config `hyperliquid_analyst_sources.json` + `context_hip3_news` dans le rapport.
- Ordre des jobs : Parvati et Intel avant Eva (déjà le cas) ; pas de nouveau cron obligatoire.
