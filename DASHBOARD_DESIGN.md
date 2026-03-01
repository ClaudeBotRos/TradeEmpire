# Design attendu — Dashboard TradeEmpire

**Modèle visuel** : [`themeDash.webp`](./themeDash.webp) (dans ce répertoire) — à utiliser comme référence pour le rendu du dashboard (layout, couleurs, sidebar, zone centrale).

**Style** : template type « Progra.AI » — thème sombre, accents orange chaud, interface responsive. Ce document fixe le design cible pour le dashboard TradeEmpire et le mapping avec les modules du PRD.

---

## 1. Style global

- **Thème** : dark (fond gris foncé / noir), **accents orange chaud** (CTA, liens actifs, highlights).
- **Responsive** : adaptation tablette/desktop + mobile (sidebar repliable, hamburger menu sur mobile).
- **Ton** : moderne, épuré, orienté productivité (AI / dev / trading).

---

## 2. Structure de la page

### 2.1 Header (haut de page)

- **Logo** à gauche (ex. TradeEmpire ou logo OpenClaw) avec petite icône.
- **Navigation** : liens type Home, About, Features, Pages, Blog (à adapter : Dashboard, Team, Intel, etc.).
- **CTA** à droite : bouton principal orange type « Try » / « Launch » (ex. « Ouvrir le dashboard » ou « Nouveau brief »).

### 2.2 Zone principale : dashboard embarqué

Le cœur de l’interface est un **bloc dashboard** (cadre gris foncé, bords arrondis) qui contient :

#### Barre supérieure du dashboard

- Logo à gauche.
- À droite : icône **Share** (partage), **avatar / profil utilisateur**.
- Boutons d’action secondaires (ex. « Try For Free », « Watch Demo ») — à remplacer par actions métier (ex. « Brief du jour », « Export »).

#### Sidebar gauche (navigation du dashboard)

- **Bouton principal en haut** : icône « + » + libellé type **« New page »** → pour TradeEmpire : **« Nouvelle tâche »** ou **« Création nocturne »** (propositions d’amélioration, nouvelles pages/modules).
- Liste d’entrées avec icônes :
  - **Search** (loupe) — recherche globale.
  - **Projects** (dossier) — peut correspondre à **TimeLine** (roadmap) + **Kanban** (Board des tâches) ou aux stratégies/agents.
  - **Community** (personnes) — peut correspondre au module **Wire** (échanges entre agents) et/ou **Team** (équipe d’agents).
  - **Settings** (engrenage) — paramètres, règles, APIs (et **Besoins API**).

**Mapping proposé avec les modules PRD :**

| Entrée sidebar | Module(s) TradeEmpire |
|----------------|------------------------|
| New page / Nouvelle tâche | Créations Nocturnes, Kanban (nouvelles cartes) |
| Search | Recherche globale (idées, signaux, journal, agents) |
| Projects | **TimeLine** (roadmap déploiement) + **Kanban** (Board des tâches) |
| Community | **Team** (agents, fiches, fichiers) + **Wire** (échanges entre agents) |
| Settings | Règles, **Besoins API**, config (APIs par agent), **Cost** (optionnel) ou lien vers **Cost** |

Entrées supplémentaires à prévoir dans la sidebar (ou sous-menus) :

- **Niches** — fiches scorées par trade idea.
- **Intel** — OpenClaw Intel (veille, scrape, classement).
- **Cost** — coûts, fees, funding, drawdown, ROI.

#### Zone centrale (contenu principal)

- **Titre d’accroche** : type « What are you creating today? » → pour TradeEmpire : « Que créez-vous aujourd’hui ? » ou « Brief du jour » / « Idées à valider ».
- **Champ de saisie large** (textarea ou input) avec placeholder (ex. « Générer un site e‑commerce » → « Décrire une idée de trade » ou « Demande au BOSS »).
- **Boutons / suggestions rapides** sous le champ (icône + libellé) :
  - Ex. « Ecommerce website », « Personal blog », « Landing page », « Portfolio »  
  - → à adapter : **« Nouvelle idée »**, **« Brief matin »**, **« Fiche Niches »**, **« Demande API »**, etc.
- Zone pour contenu secondaire (formatage, pièces jointes) si besoin.

Cette zone centrale peut servir :

- À l’**opérateur** : saisie de requêtes, validation, consultation du brief.
- Au **BOSS** : point d’entrée pour commandes ou synthèses.
- Pour afficher le **contenu du module actif** (Kanban, Wire, Niches, Intel, Cost, Team) selon la sélection dans la sidebar.

### 2.3 Sections additionnelles (hors cadre dashboard)

- **Hero** (au-dessus du dashboard) : titre + sous-titre + CTA — optionnel pour landing ; en mode « app », le dashboard peut occuper toute la hauteur.
- **Trusted by / Partenaires** (logos) en bas — optionnel ; peut être remplacé par « Modules », « Stats », ou retiré.

---

## 3. Vue mobile

- **Header** : logo + **menu hamburger** (navigation repliée).
- **Hero** : même titre / sous-titre, boutons empilés.
- **Dashboard** : même bloc que desktop, en largeur réduite ; **sidebar en drawer / overlay** ouvert via le hamburger.
- Les modules (Team, TimeLine, Wire, Niches, Intel, Cost) restent accessibles ; listes et tableaux en scroll horizontal ou vue simplifiée.

---

## 4. Récapitulatif — design à garder en mémoire

- **Thème** : dark, accents orange.
- **Layout** : header + bloc principal avec **sidebar gauche** (nav + « New page ») + **zone centrale** (titre, input, suggestions).
- **Sidebar** : New page, Search, Projects (→ TimeLine + Kanban), Community (→ Team + Wire), Settings (+ Niches, Intel, Cost en entrées dédiées ou sous-menus).
- **Centre** : point d’entrée principal (brief, idées, demande au BOSS) + suggestions rapides ; ou affichage du module sélectionné.
- **Responsive** : sidebar en drawer sur mobile, hamburger pour la nav.

Ce document sert de **référence design** pour l’implémentation du dashboard TradeEmpire (PRD §6). La maquette visuelle à reproduire est **`themeDash.webp`** dans ce même répertoire.

---
*Référence enregistrée pour le projet TradeEmpire — design dashboard. Modèle : `workspace/TradeEmpire/themeDash.webp`.*
