# Cron — Chevauchements et consommation LLM

## Jobs agentTurn (tous consomment des tokens)

### Créneau 07:50–08:30
| Heure  | Job                         | Note        |
|--------|-----------------------------|-------------|
| 07:50  | cleanup-unexecuted          | 1 tour      |
| 08:15  | **tradeempire-morning**     | Lourd (run-morning + brief) |
| 08:25  | tradeempire-executor       | 10 min après morning |

**Verdict** : OK. Morning peut durer ~60 s ; executor à 08:25 laisse un peu de marge.

---

### Créneau 09:00–10:00 (à risque)
| Heure  | Job                         |
|--------|-----------------------------|
| 09:00  | tradeempire-intel          |
| 09:05  | veille airdrops            |
| 09:15  | email-todo-9              |
| 09:20  | opportunity-scout          |
| 09:22  | scout-validation-status    |
| 09:30  | agent-report              |
| 09:45  | **boss-vision**            |

**7 jobs en 45 min** → risque de pics tokens et timeouts. **Mesure appliquée** : validation 9h35, agent-report 9h40, airdrops 9h50, boss-vision 10h00. Ordre du matin : 9h intel, 9h15 email-todo-9, 9h20 scout, 9h35 scout-validation, 9h40 agent-report, 9h50 airdrops, 10h boss-vision.

---

### Récurrents (très fréquents)
| Job                    | Fréquence    | Tours LLM/heure |
|------------------------|--------------|------------------|
| tradeempire-whatsapp-pending | Toutes les 5 min  | **12** |
| tradeempire-tp-scrutator     | Toutes les 10 min | **6**  |
| openclaw-watchguard          | Toutes les 15 min | **4**  |

**Mesure** : WhatsApp pending → toutes les 15 min (4/h). TP scrutator → toutes les 15 min (4/h). Réduit fortement les tokens sans changer la logique métier.

---

### 12h, 15h, 18h
| Heure  | Jobs |
|--------|------|
| 12:00  | email-todo-12 |
| 12:08  | executor-12h  |
| 12:25  | opportunity-scout-1225 |
| 12:30  | recovery-intraday (technicals + recovery, 120 s) |

Même schéma à 15h et 18h (18h : recovery 18:00, email 18:12). **Verdict** : acceptable, pas simultané.

---

### Soir 20:30–21:15
| Heure  | Job                |
|--------|--------------------|
| 20:30  | tradeempire-evening |
| 21:00  | tradeempire-chase   |
| 21:15  | recovery-analyst    |

3 jobs en 45 min. **Verdict** : acceptable.

---

### Nuit 01:00–01:03
| Heure  | Job                    |
|--------|------------------------|
| 01:00  | **boss-night** (300 s) |
| 01:03  | boss-night-whatsapp-fallback |

Fallback 3 min après BOSS. **Verdict** : OK.

---

## Modifications appliquées (réduction tokens)

1. **9h** : Étaler les jobs (scout-validation 9h35, agent-report 9h40, airdrops 9h50, boss-vision 10h).
2. **whatsapp-pending** : 5 min → 15 min (expr: 5,20,35,50).
3. **tp-scrutator** : 10 min → 15 min (expr: 5,20,35,50).
