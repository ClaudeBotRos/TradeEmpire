# Tâches Intel (Daphnée)

1. **X (Twitter)** : interroger l’API X (recherche recent) sur crypto/bitcoin, extraire thèmes et tendances du jour, produire une ou plusieurs Trend Cards (titre, résumé, source X).
2. **YouTube** : lire la liste des URLs « top vidéos crypto » (config ou flux), récupérer le transcript (skill youtube-watcher) ou métadonnées, produire une Trend Card par vidéo (titre, résumé court).
3. **Calendrier économique (investing.com)** : vérifier le calendrier économique traditionnel (https://www.investing.com/economic-calendar) pour les dates/heures clés (Fed, NFP, CPI, PMI, etc.) ; garder les événements en mémoire (`data/dashboard/intel/economic_calendar.json`) ; après publication, vérifier les chiffres publiés (actual vs forecast/previous) ; intégrer les événements macro aux Trend Cards (carte « Macro ») pour l’orchestrateur et les tendances.
4. **Sortie** : écrire `data/dashboard/intel/trend_cards.json` (date, liste de cartes avec source, title, summary, url, classification) et `data/dashboard/intel/economic_calendar.json` (événements à venir + actuals après publication). Le dashboard et le BOSS consomment ces fichiers.
