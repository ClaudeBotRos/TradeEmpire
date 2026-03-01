# Risk Rules (non négociables)

- **Max perte par trade** : 50 USD (à ajuster)
- **Max perte par jour** : 150 USD (à ajuster)
- **Max trades par jour** : 5
- **Max positions ouvertes** : 3
- **Leverage max** : 2

## Interdictions

- Pas de martingale
- Pas de moyenne à la baisse (sauf stratégie explicitement définie)
- Pas de trade si volatilité extrême (règle objective à définir, ex. ATR > X % du prix)
- Pas de trade pendant news macro (optionnel)

## Exigences sur toute trade idea

- Invalidation claire
- R:R minimum (ex. 1.2)
- Taille de position et perte max calculée
