# Tâches Tibo

1. **Executor** : exécuter `scripts/executor-run.js` (depuis la racine du workspace) pour placer les ordres d’entrée et stop-loss des idées APPROVED sur ASTER. Respecter la limite d’ordres par jour et la marge configurée.
2. **Scrutator** : exécuter `scripts/executor-tp-scrutator.js` pour vérifier les ordres d’entrée en attente de TP ; si un ordre est FILLED, placer le Take Profit (LIMIT reduceOnly) et mettre à jour les fichiers.
3. **Rapport** : après chaque run (executor ou scrutator), mettre à jour le rapport dans `data/dashboard/tibo_report.json`. Ce rapport est lu par le BOSS pour le suivi et par Chase pour le post-mortem (qualité d’exécution, erreurs, ordres placés).
