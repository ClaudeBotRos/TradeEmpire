# Execution Policy

## V1

- **Exécution manuelle ou paper uniquement.**
- Aucun ordre envoyé par le système.

## V2 (quand activé)

- **Venue d’exécution** : ASTER (AsterDEX futures). Clés API dans DTO/app/.env ; client TradeEmpire : `scripts/aster-client.js`. Voir `docs/EXECUTION_ASTER.md`.
- Exécution automatique uniquement si : stratégie figée, risque strict (max loss/jour, max positions, taille fixe), audit complet, kill switch.
- Agent EXECUTOR très bridé (passe les ordres, point).
