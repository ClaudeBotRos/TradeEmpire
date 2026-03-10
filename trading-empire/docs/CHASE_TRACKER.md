# Chase (Tracker) — Post-mortem et feedback

## Rôle

Quand une idée est **APPROVED** par RISK_JOURNAL, elle est enregistrée pour suivi. L’agent **Chase** (Tracker) :

1. **Enregistrement** : À chaque APPROVED, un fichier `data/tracker/outcomes/{trade_id}.json` est créé avec `outcome: "pending"`.
2. **Résultat** : Vous (ou un système) remplissez ce fichier avec le résultat réel : `outcome` = `win` | `loss` | `invalid_hit` | `target_hit` | `revoked`, et optionnellement `exit_price`, `closed_at`, `note`. **`revoked`** = ordre annulé avant exécution (ex. par Recovery) ou invalidation / clôture sans perte (realizedPnl ≈ 0) — pas une perte, bon pour les bénéfices (BOSS ne compte pas comme loss).
3. **Post-mortem — annulation d’ordres obsolètes** : À chaque run, Chase **supprime les ordres ouverts qui ne sont plus d’actualité** pour libérer de la marge : (a) **prix trop éloigné** du mark (ex. > 10 %, configurable via `CHASE_STALE_ORDER_PCT`), (b) **tendance plus bonne** (loss récent sur le symbole → annulation des TP), (c) **ordres orphelins** (plus de position sur le symbole). Cela libère de la marge pour de nouveaux trades.
4. **Compte rendu par jour** : Chase génère un **compte rendu par jour** (une date = un fichier) : `data/tracker/post_mortem/YYYY-MM-DD.md`. Chaque fichier regroupe tous les post-mortems des trades clôturés ce jour-là (résultat, verdict, note par trade).
5. **Feedback** : Chase agrège les post-mortems et écrit un feedback par agent dans `data/tracker/feedback/{AGENT}.md` et `data/dashboard/chase_feedback.json`. Les agents peuvent s’en servir pour améliorer leur stratégie.
6. **Diagnostic des pertes** : À chaque run, Chase lance `chase-loss-diagnostic.js`, qui analyse les outcomes `outcome: "loss"`, agrège par symbole/direction, et écrit `data/dashboard/chase_loss_diagnostic.json` et `chase_loss_diagnostic.md` (causes possibles : signaux défaillants, timing, conditions marché ; recommandations). Consulter ce rapport pour le BOSS et le risk management.

## Fichiers

| Fichier / Dossier | Description |
|-------------------|-------------|
| `data/tracker/outcomes/{trade_id}.json` | Résultat du trade (pending → win/loss/invalid_hit/target_hit). À remplir manuellement ou par clôture. |
| `data/tracker/post_mortem/YYYY-MM-DD.md` | Compte rendu Chase du jour (tous les trades clôturés à cette date, verdict + note par trade). |
| `data/tracker/feedback/TECHNICALS.md` etc. | Feedback pour chaque agent. |
| `data/dashboard/chase_feedback.json` | Synthèse (timestamp, by_agent, post_mortem_count, post_mortem_new_count). |
| `data/dashboard/chase_loss_diagnostic.json` / `.md` | Diagnostic des pertes : agrégation par symbole/direction, causes possibles, recommandations (généré à chaque run Chase). |
| `data/tracker/chase_processed_outcomes.json` | Historique des `trade_id` déjà diffusés dans le feedback — Chase n’inclut que les **nouveaux** outcomes à chaque run pour éviter de répéter les mêmes ordres fermés. |

## Vérification automatique des positions fermées (tool Chase)

À chaque exécution, **Chase** interroge ASTER (si les clés API sont configurées) pour :

1. **Lire les positions ouvertes** (`positionRisk`) et la liste des ordres exécutés (`executed_orders.json`).
2. **Repérer les trades dont le symbole n’a plus de position** (position fermée).
3. **Récupérer l’historique des trades** (`userTrades`) pour ce symbole et faire correspondre l’ordre de clôture :
   - si l’ordre rempli est le **SL** → `outcome: "loss"` (note : « SL détecté (Chase via ASTER) ») ;
   - si c’est le **TP** → `outcome: "target_hit"` (note : « TP détecté (Chase via ASTER) ») ;
   - si la clôture ne correspond à aucun ordre SL/TP connu (ex. clôture manuelle) → `outcome: "loss"` avec note « ordre de clôture non identifié (manuel?) ».
4. **Mettre à jour** `data/tracker/outcomes/{trade_id}.json` avec `outcome`, `exit_price`, `closed_at`, puis enchaîner sur la génération des post-mortems et du feedback.

Vous n’avez **pas besoin de remplir un fichier à la main** : il suffit de lancer `node scripts/chase-tracker.js` (manuellement ou en cron). Chase gère la détection des positions fermées, **l’annulation des ordres obsolètes** (marge libérée), et la mise à jour des outcomes tout seul. Seuil « prix trop éloigné » : variable d’environnement `CHASE_STALE_ORDER_PCT` (pourcentage, défaut 10).

## Pourquoi Chase n’a pas de retour sur les ordres de la veille ?

Chase ne peut produire des **post-mortems** que pour les trades **clôturés** dans le tracker :

1. **Outcomes en `pending`** : Tant qu’un fichier `data/tracker/outcomes/{trade_id}.json` garde `outcome: "pending"`, Chase n’a aucun résultat à analyser pour ce trade.
2. **Sync automatique** : Si ASTER est configuré, Chase met à jour les outcomes des positions fermées à chaque run (voir ci‑dessus). Sinon, vous pouvez encore remplir manuellement les outcomes ou utiliser `sync-closed-outcomes-and-chase.js` avec `closed_positions.json` ou `--detect`.
3. **Exécution** : `chase-tracker.js` n’est pas dans `run-morning.js`. L’appeler manuellement ou via un cron (ex. soir) : `node scripts/chase-tracker.js`.

## Option manuelle : closed_positions.json et sync-closed-outcomes-and-chase.js

Si ASTER n’est pas configuré ou pour **surcharger** les résultats, vous pouvez :

- Remplir `data/tracker/closed_positions.json` avec des entrées `{ "trade_id", "outcome", "exit_price?", "closed_at?", "note?" }`, puis lancer `node scripts/sync-closed-outcomes-and-chase.js` : le script met à jour les outcomes puis appelle Chase.
- Avec `--detect`, le script interroge ASTER (positionRisk) pour repérer les symboles sans position et ajoute des clôtures (outcome par défaut `loss`). Les entrées manuelles dans `closed_positions.json` ne sont pas écrasées.

## Commandes

- **Tout-en-un (recommandé)** : `node scripts/chase-tracker.js` — sync des positions fermées via ASTER (si dispo), puis post-mortems et feedback.
- **Enregistrement des idées** : à chaque APPROVED, `risk-journal-scan.js` crée l’outcome en `pending`.
- **Option manuelle** : `node scripts/sync-closed-outcomes-and-chase.js` (éventuellement `--detect`) si vous utilisez `closed_positions.json` ou la détection ASTER sans lancer Chase ensuite.

## Comment le post-mortem est géré par les agents qui le reçoivent

Chase écrit le feedback à deux endroits :

- **Par agent** : `data/tracker/feedback/{AGENT}.md` (ex. `TECHNICALS.md`, `ORCHESTRATOR.md`, `tibo.md`) — texte du type « Retours Chase : idea_XXX → loss ; idea_YYY → target_hit ».
- **Synthèse** : `data/dashboard/chase_feedback.json` (timestamp, `post_mortem_count`, `by_agent`).
- **Compte rendu par jour** : `data/tracker/post_mortem/YYYY-MM-DD.md` (tous les trades clôturés ce jour, verdict, prix de sortie, note).

**Qui consomme ce feedback aujourd’hui ?**

| Consommateur | Ce qu’il lit | Usage |
|--------------|--------------|--------|
| **BOSS (nuit)** | `chase_feedback.json` (injecté dans `boss_night_context.json`) | Le BOSS reçoit `chase_feedback.post_mortem_count` et `chase_feedback.by_agent` et doit « prendre en compte dans tes propositions » (instructions dans boss-night.js). C’est le seul flux automatisé qui utilise le post-mortem pour décider. |
| **Dashboard** | `/api/chase_feedback`, `/api/chase_post_mortems`, `/api/chase_post_mortem/:date` | Affichage : vue Chase, liste des comptes rendus par jour (date), détail en cliquant sur une date. |
| **Orchestrator, Risk Journal, run-morning** | `chase-feedback-loader.js` (lit outcomes complétés) | **Lecture automatique** : renforcement des critères (symboles loss → idées plus exigeantes), règles risk renforcées (R:R 1,5, levier 1), et activation de TradingView RapidAPI quand il y a des losses. |
| **Autres agents (TECHNICALS, SMART_MONEY, SENTIMENT_X)** | Fichiers `data/tracker/feedback/{AGENT}.md` | Contexte disponible ; l’amélioration passe par run-morning (plus d’APIs) et par l’orchestrator (critères renforcés par symbole). |

**Adaptation des agents quand les post-mortems sont en loss**

Les agents s’appuient sur le module **`scripts/chase-feedback-loader.js`** (outcomes complétés) pour adapter leur technique :

| Agent | Comportement quand il y a des loss récents |
|--------|--------------------------------------------|
| **Orchestrator** | Pour les symboles ayant eu un loss/invalid_hit, une idée n’est proposée que si : (1) indicateurs RapidAPI (RSI/MACD) présents pour ce symbole, (2) alignement Intel (narrative) non défavorable, (3) confiance ≥ 75 %. Sinon l’idée est ignorée (amélioration en exigeant plus de signaux). |
| **Risk Journal** | Si au moins un loss récent : règles renforcées — R:R minimum porté à 1,5 et levier max à 1 (en plus des règles dans `risk_rules.md`). |
| **Technicals (run-morning)** | Si Chase signale des losses : en plus des étapes habituelles, exécution de **TradingView events calendar** (RapidAPI) pour fournir plus de données à l’orchestrator. |

En résumé : le post-mortem est **produit** par Chase, **affiché** dans le dashboard, **injecté dans le contexte du BOSS** pour la nuit, et **lu par l’orchestrator, le risk-journal et run-morning** pour renforcer les critères et activer davantage d’APIs RapidAPI en cas de loss.

## Dashboard

La vue **Chase (Tracker)** affiche le feedback par agent et la liste des **comptes rendus par jour** (cliquables pour lire le détail du jour).
