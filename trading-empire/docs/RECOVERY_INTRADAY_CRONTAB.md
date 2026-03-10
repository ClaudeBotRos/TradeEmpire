# Recovery intraday — Contexte + analyse agent, exécution fiable

## Comportement

La revue Recovery **dépend du contexte et d’une analyse** (tendance, Scout, Chase), pas d’une règle binaire seule. Le script standalone fait :

1. **technicals-scan.js** — Tendance à jour.
2. **recovery-intraday-context.js** — Construit `recovery_intraday_context.json` (ordres ouverts ASTER + technicals + Scout + Chase).
3. **Agent** — Lit le contexte, analyse pour chaque ordre (keep/cancel + raison), écrit `recovery_agent_recommendations.json`.  
   Si l’agent timeout ou erreur provider → on continue : l’étape 4 utilisera la **règle simple** (trend vs side).
4. **recovery-intraday-review.js --md --apply-cancel** — Utilise les reco agent si le fichier est récent (< 15 min), sinon règle simple. Applique les annulations sur ASTER.

Résultat : **analyse contextuelle quand l’agent répond**, **secours fiable** (règle simple) sinon.

---

## Script à lancer

```bash
cd /home/rosito/.openclaw/workspace/TradeEmpire/trading-empire && node scripts/run-recovery-intraday-standalone.js
```

- Contexte : ordres + technicals + Scout + Chase.
- Agent : décision keep/cancel avec raison (tenant compte du contexte).
- Apply : applique les recommandations (ou règle simple si pas de fichier agent).

---

## Installer le crontab

1. Ouvrir le crontab : `crontab -e`

2. Ajouter ces 3 lignes (horaires Europe/Paris : 12:30, 15:30, 18:00) :

   ```cron
   # Recovery intraday TradeEmpire (contexte + agent, secours règle simple)
   30 12 * * * cd /home/rosito/.openclaw/workspace/TradeEmpire/trading-empire && node scripts/run-recovery-intraday-standalone.js >> /tmp/recovery-intraday.log 2>&1
   30 15 * * * cd /home/rosito/.openclaw/workspace/TradeEmpire/trading-empire && node scripts/run-recovery-intraday-standalone.js >> /tmp/recovery-intraday.log 2>&1
   0 18 * * * cd /home/rosito/.openclaw/workspace/TradeEmpire/trading-empire && node scripts/run-recovery-intraday-standalone.js >> /tmp/recovery-intraday.log 2>&1
   ```

3. Sauvegarder.

---

## Vérifier

- **Log** : `tail -f /tmp/recovery-intraday.log`
- **Rapport** : `data/dashboard/recovery_intraday_report.json` et `data/reports/YYYY-MM-DD_intraday_review.md`
- **Reco agent** : `data/dashboard/recovery_agent_recommendations.json` (présent et récent si l’agent a répondu)

---

## Jobs OpenClaw

Les 3 jobs **tradeempire-recovery-intraday-1230**, **-1530**, **-18h** restent **désactivés**. La revue intraday repose sur le crontab ci-dessus (contexte + agent + apply).
