# Tâches Chase (Tracker)

1. **Vérifier les positions fermées** : interroger ASTER (positionRisk, userTrades), comparer avec executed_orders.json ; pour chaque symbole sans position ouverte, identifier l’ordre de clôture (SL ou TP) et mettre à jour data/tracker/outcomes/{trade_id}.json (outcome, exit_price, closed_at). Gérer tout seul sans fichier manuel.
2. **Annuler les ordres obsolètes (post-mortem)** : pour libérer de la marge, annuler les ordres ouverts qui ne sont plus d’actualité : (a) **prix trop éloigné** du mark (seuil configurable, ex. 10 % via CHASE_STALE_ORDER_PCT), (b) **tendance plus bonne** (loss récent sur le symbole → annuler les TP), (c) **orphelins** (plus de position ouverte sur le symbole). Exécuté à chaque run après le sync des positions fermées.
3. Synchroniser les idées APPROVED avec le registre de suivi (data/tracker/outcomes/) : créer un fichier outcome « pending » par idée approuvée si absent.
4. Pour chaque outcome complété (outcome !== 'pending'), générer un post-mortem (data/tracker/post_mortem/{trade_id}.md) : idée bonne ou mauvaise, pourquoi.
5. Utiliser les données d'exécution de Tibo (tibo_report.json, executed_orders.json) dans les post-mortems et le feedback Tibo (qualité d'exécution, TP, marge).
6. Agréger les post-mortems en feedback par agent (data/tracker/feedback/) pour que chaque agent puisse lire et ajuster sa stratégie.
