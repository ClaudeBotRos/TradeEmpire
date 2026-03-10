# WhatsApp — Messages importants (agents)

Chaque agent a le **droit d'envoyer un message WhatsApp** à l'utilisateur en cas de message important (alerte, point d'attention, résumé critique, etc.).

## Mécanisme

**Important :** La livraison cron OpenClaw (`delivery.mode: "announce"`) ne fonctionne pas en pratique (réponse de l’agent non envoyée). Tous les messages qui doivent arriver sur WhatsApp passent donc par la **file** ci‑dessous, consommée par `send-whatsapp-pending.js` (cron toutes les 15 min).

1. **File d'attente** : `data/notifications/whatsapp_pending.json`  
   Tableau d'entrées `{ "agentId", "message", "createdAt" }`. Les scripts ou agents y ajoutent une entrée quand ils jugent qu'un message doit être envoyé. **Le script préfixe automatiquement le message avec le nom de l'agent** (ex. `[Chase] …`, `[Daphnée (Intel)] …`), pour que l'utilisateur sache qui lui écrit.

2. **Script** : `scripts/notify-user-whatsapp.js`  
   À appeler depuis un script agent (ex. Chase, Intel, Risk, etc.) pour mettre en file un message important.  
   Usage :  
   `node scripts/notify-user-whatsapp.js <agentId> "<message>"`  
   ou avec variables d'environnement :  
   `AGENT_ID=chase NOTIFY_MESSAGE="..." node scripts/notify-user-whatsapp.js`

3. **Envoi** : le script `scripts/send-whatsapp-pending.js` consomme la file (lecture de `whatsapp_pending.json`, envoi de chaque message via `openclaw message send --channel whatsapp`, puis vidage des entrées envoyées). Il est lancé toutes les 5 minutes par le cron **tradeempire-whatsapp-pending**. En lancement manuel de la chaîne complète (Scout + Recovery), utiliser `node scripts/run-scout-recovery-chain.js` : il enchaîne Scout → validation → Recovery intraday puis envoie tout de suite la file WhatsApp. Le gateway OpenClaw doit être démarré et WhatsApp connecté (`openclaw channels login --channel whatsapp --account custom-1`) pour que les messages partent. Variables d'environnement optionnelles : `WHATSAPP_TO` (défaut +33625174653), `WHATSAPP_ACCOUNT` (défaut custom-1).

## Quand utiliser

- **Chase** : alerte après une série de pertes, ou résumé post-mortem important.
- **Intel (Daphnée)** : signal fort sur un trend (ex. événement macro majeur).
- **Risk Journal** : alerte risque ou dégradation contexte.
- **Technicals / Smart Money / Sentiment** : signal critique à porter à l'attention.
- **Orchestrator** : décision ou blocage important.
- **Brief matin** (08:15) : `morning-brief.js` met le brief en file après génération → envoyé par `send-whatsapp-pending`.
- **Récap soir** (20:30) : `evening-brief.js` met le récap en file → envoyé par `send-whatsapp-pending`.
- **BOSS vision** (10:00) : après écriture de `boss_expansion_proposals.md`, l’agent lance `queue-boss-vision-brief.js` → contenu mis en file → envoyé par `send-whatsapp-pending`.
- **BOSS** : le brief de nuit est mis en file par le fallback (`boss-night-brief-to-whatsapp-fallback.js` à 01:03) à partir de `last_boss_brief.md` ; BOSS doit écrire son brief dans ce fichier avant de répondre. Le fallback n’envoie **jamais** un ancien message (fichier < 2 h, run récent).

Rester sobre : un message « important » = vraiment utile pour l'utilisateur, pas du bruit.

## Format du message

Texte libre, court de préférence (WhatsApp). **Qui écrit** : le script ajoute automatiquement le nom de l'agent au début du message (ex. `[Chase] …`, `[Daphnée (Intel)] …`), pour que tu voies toujours qui t'écrit. La file garde aussi `agentId` pour le consommateur.
