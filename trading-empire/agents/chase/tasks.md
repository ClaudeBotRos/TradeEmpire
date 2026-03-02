# Tâches Chase (Tracker)

1. Synchroniser les idées APPROVED avec le registre de suivi (data/tracker/outcomes/) : créer un fichier outcome « pending » par idée approuvée si absent.
2. Pour chaque outcome complété (outcome !== 'pending'), générer un post-mortem (data/tracker/post_mortem/{trade_id}.md) : idée bonne ou mauvaise, pourquoi.
3. Utiliser les données d'exécution de Tibo (data/dashboard/tibo_report.json, executed_orders.json) dans les post-mortems : qualité d'exécution, TP placés ou en retard, erreurs, marge. Produire un feedback pour Tibo (data/tracker/feedback/tibo.md) pour améliorer l'exécution et le trading.
4. Agréger les post-mortems en feedback par agent (data/tracker/feedback/) pour que chaque agent puisse lire et ajuster sa stratégie.
