# Tâches Intel (Daphnée)

1. **X (Twitter)** : interroger l’API X (recherche recent) sur crypto/bitcoin, extraire thèmes et tendances du jour, produire une ou plusieurs Trend Cards (titre, résumé, source X).
2. **YouTube** : lire la liste des URLs « top vidéos crypto » (config ou flux), récupérer le transcript (skill youtube-watcher) ou métadonnées, produire une Trend Card par vidéo (titre, résumé court).
3. **Sortie** : écrire `data/dashboard/intel/trend_cards.json` (date, liste de cartes avec source, title, summary, url, classification). Le dashboard et le BOSS consomment ce fichier.
