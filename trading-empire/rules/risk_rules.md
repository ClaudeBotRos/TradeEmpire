# Risk Rules (non négociables)

- **Max perte par trade** : 50 USD (à ajuster)
- **Max perte par jour** : 150 USD (à ajuster)
- **Max trades par jour** : 10
- **Max 1 ordre par sens et par paire par jour** : un long et/ou un short max par paire (ex. 1 LONG BTCUSDT + 1 SHORT BTCUSDT max par jour).
- **Max positions ouvertes** : 3
- **Leverage max** : 5
- **Leverage max (confiance ≥80%)** : 10 (double autorisé pour signaux à confiance ≥80%, R:R conservateur maintenu ; RISK_JOURNAL valide).

## Interdictions

- Pas de martingale
- Pas de moyenne à la baisse (sauf stratégie explicitement définie)
- Pas de trade si volatilité extrême (règle objective à définir, ex. ATR > X % du prix)
- Pas de trade pendant news macro (optionnel)

## Exigences sur toute trade idea

- Invalidation claire
- R:R minimum (ex. 1.2)
- Taille de position et perte max calculée
