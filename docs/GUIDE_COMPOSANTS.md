# Guide : créer et gérer les composants du dashboard

Ce guide explique comment activer, désactiver, déplacer, **créer de zéro** et déboguer
les composants du dashboard RaspDash, sans jamais toucher au code du Raspberry.

## 1. Vue d'ensemble

```
┌──────────────────────────┐      écritures       ┌───────────────────┐
│  Console d'administration │──(Auth email/mdp)──▶│     Firestore     │
│  raspdash-config.web.app  │                     │    collection     │
│  (Firebase Hosting)       │◀──── temps réel ────│   "components"    │
└──────────────────────────┘                      └─────────┬─────────┘
      aussi accessible en local :                           │ temps réel (onSnapshot)
      http://<ip-du-raspberry>:3000/admin                   ▼
                                               ┌────────────────────────┐
                                               │  Dashboard Raspberry   │
                                               │  /dynamic.html         │
                                               │  monte/démonte les     │
                                               │  composants en direct  │
                                               └────────────────────────┘
```

- **Chaque composant du dashboard = un document Firestore** dans la collection `components`.
- Le dashboard (`public/dynamic.html` + `public/js/app-dynamic.js`) écoute la collection
  en temps réel : toute création, modification, activation/désactivation ou suppression
  est visible sur l'écran du Raspberry **en moins d'une seconde, sans rechargement**.
- La console d'administration est une simple page web hébergée sur Firebase :
  vous pouvez gérer le dashboard depuis n'importe où (téléphone inclus).

### Les deux familles de composants

| Famille | `type` | Code | Instances |
|---|---|---|---|
| **Intégrés** | `clock`, `weather`, `stats`, `quran`, `prayers`, `hijri_services` | déjà dans `app-dynamic.js` | 1 seule instance par type |
| **Custom** | `custom` | stocké **dans le document Firestore** (HTML + CSS + JS) | illimitées |

## 2. Mise en route (une seule fois)

La console d'admin est déjà déployée sur **https://raspdash-config.web.app**.
Il ne reste qu'à activer l'authentification (Google n'offre pas d'API gratuite pour
cette première étape, elle se fait donc en 1 clic dans la console web) :

1. Ouvrez https://console.firebase.google.com/project/raspdash-config/authentication
   et cliquez sur **« Commencer » / « Get started »**. Rien d'autre à faire sur cette page.
2. Sur votre Mac (là où `firebase login` est déjà fait), lancez :

   ```bash
   node scripts/setup-auth.js tekaya.rami@gmail.com 'VotreMotDePasse'
   ```

   Le script active le provider Email/Mot de passe, crée votre compte admin,
   **ferme l'auto-inscription** (personne d'autre ne pourra créer de compte) et
   vérifie que la clé API web du projet autorise le service d'authentification
   (les clés créées avant l'activation d'Auth le bloquent).
3. Connectez-vous sur https://raspdash-config.web.app — c'est prêt.

> **Sécurité** : les règles Firestore (`firestore.rules`) n'autorisent l'écriture
> qu'au compte `tekaya.rami@gmail.com`. La lecture est publique (le dashboard lit
> sans se connecter). Pour changer d'admin, modifiez l'email dans `firestore.rules`
> puis `firebase deploy --only firestore:rules`.

### Accès local (LAN)

La même console est servie par le Raspberry : `http://<ip-du-raspberry>:3000/admin`.
Avantage : le bouton **Aperçu** de l'éditeur peut alors appeler les vraies API du Pi
(`/api/stats`, `/api/weather`…) et montrer le composant avec de vraies données.

## 3. Gérer les composants existants

Dans la console d'admin, les composants sont groupés par zone du dashboard :

- **Zone haut** : bandeau supérieur (pleine largeur)
- **Colonne gauche** (280 px) et **colonne droite** (240 px)

Pour chaque composant :

| Action | Comment | Effet sur l'écran |
|---|---|---|
| Activer / désactiver | l'interrupteur de la carte | le panneau apparaît/disparaît instantanément |
| Réordonner | boutons ▲ ▼ | le panneau se déplace dans sa zone |
| Changer de zone, renommer, config | ✎ Modifier | remontage immédiat |
| Supprimer | ✎ Modifier → Supprimer | disparition immédiate |

**Ajouter un type intégré** : « ＋ Nouveau composant » → choisissez dans la liste.
Un type intégré déjà présent est grisé (une seule instance possible, leurs éléments
HTML utilisent des ids globaux).

## 4. Créer un composant from scratch

« ＋ Nouveau composant » → **Composant custom**. L'éditeur s'ouvre avec un exemple
minimal qui marche. Le menu **« Exemples… »** propose des modèles complets
(prix du Bitcoin, CPU du Pi, compte à rebours) — le plus simple est de partir de l'un d'eux.

### 4.1 Anatomie d'un composant custom

Un composant custom est un document Firestore avec ces champs :

```
name    : "Bitcoin"          — nom affiché dans la console d'admin
type    : "custom"
zone    : "top" | "left" | "right"
order   : 1                  — position dans la zone (croissant de haut en bas)
enabled : true | false
html    : "<div>…</div>"     — la structure du widget
css     : ".prix { … }"      — ses styles (isolés du reste du dashboard)
js      : "ctx.every(…)"     — sa logique (optionnel)
config  : { "refreshMs": 60000 }  — paramètres libres, lus par votre JS
```

Sur le dashboard, le composant est enveloppé dans un panneau « verre dépoli »
(`glass-panel`) comme les autres widgets, et son contenu vit dans un **Shadow DOM** :

- vos sélecteurs CSS et vos `id` ne peuvent pas entrer en collision avec le reste
  du dashboard (ni avec un autre composant custom) ;
- en contrepartie, les classes CSS globales du dashboard ne s'appliquent pas à
  l'intérieur : écrivez votre propre CSS (les polices, elles, sont héritées).

### 4.2 L'API `ctx` (disponible dans votre JS)

Votre code JS est exécuté une fois au montage du composant, avec un objet `ctx` :

| Membre | Description |
|---|---|
| `ctx.root` | racine du composant (ShadowRoot). **Toujours** cibler vos éléments via `ctx.root.querySelector('#mon-id')` — jamais `document.getElementById`. |
| `ctx.config` | l'objet du champ « Config (JSON) ». Modifier la config depuis l'admin remonte le composant avec les nouvelles valeurs. |
| `ctx.fetchJson(url)` | `GET` qui renvoie le JSON, ou `null` en cas d'erreur (réseau, HTTP ≠ 2xx). Gérez toujours le cas `null`. |
| `ctx.every(ms, fn)` | exécute `fn` immédiatement puis toutes les `ms` millisecondes. L'intervalle est **automatiquement arrêté** quand le composant est désactivé/supprimé/modifié. N'utilisez pas `setInterval` directement (fuite d'intervalle au démontage). |
| `ctx.onCleanup(fn)` | enregistre une fonction appelée au démontage (fermer un WebSocket, retirer un listener global…). |
| `ctx.id` | l'identifiant du document Firestore (utile pour les logs). |

Le code peut utiliser `await` directement (il est exécuté comme fonction async).

### 4.3 Quelles données afficher ?

- **API du Raspberry** (URL relative) : `/api/stats`, `/api/weather`, `/api/prayers`,
  `/api/quran`, `/api/jellyfin_status`, `/api/n8n_status` — pas de problème de CORS,
  c'est la même origine que le dashboard.
- **API externes** : possibles si elles autorisent le CORS et sont en HTTPS
  (ex. CoinGecko, Open-Meteo). En cas d'erreur CORS, la requête échoue →
  `fetchJson` renvoie `null` et l'erreur se voit dans la console du navigateur.
- **Pas d'API** : horloges, compteurs, notes statiques, compte à rebours…

### 4.4 Pas à pas : un widget « Prix du Bitcoin »

1. « ＋ Nouveau composant » → **Composant custom**.
2. Menu « Exemples… » → **Prix du Bitcoin (API externe)**.
3. Regardez les 4 onglets :
   - **HTML** — la structure : un libellé et un `<div id="btc-price">`.
   - **CSS** — centrage, taille, couleur or.
   - **JS** :
     ```js
     const el = ctx.root.querySelector('#btc-price');

     ctx.every(ctx.config.refreshMs || 300000, async () => {
         const data = await ctx.fetchJson(
             'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur'
         );
         if (data && data.bitcoin) {
             el.textContent = data.bitcoin.eur.toLocaleString('fr-FR') + ' €';
         }
     });
     ```
   - **Config (JSON)** — `{ "refreshMs": 300000 }` : rafraîchissement toutes les 5 min.
4. Cliquez **▶ Aperçu** pour le voir tourner (avec la largeur réelle de la zone choisie).
5. Choisissez la zone et l'ordre, puis **Enregistrer**.
6. Regardez l'écran du Raspberry : le widget est déjà là.

Pour le modifier ensuite : ✎ Modifier → changez le code → Enregistrer → l'écran
se met à jour instantanément (l'ancienne version est proprement démontée).

### 4.5 Bonnes pratiques

- **Toujours vérifier le retour de `fetchJson`** (`if (!data) return;`) : une API
  en panne ne doit pas casser le widget.
- **Rythmes de rafraîchissement raisonnables** : 5 s pour du local, ≥ 5 min pour
  une API externe (quotas !).
- **Dimensionnez pour la zone** : colonne gauche 280 px, droite 240 px, écran
  total 800×480. Un composant trop haut fait déborder la colonne.
- Utilisez `ctx.config` pour tout ce qui est réglable (URL, seuils, textes) :
  vous pourrez ajuster sans toucher au code.
- L'écran est en mode kiosque : évitez ce qui demande une interaction souris.

## 5. Sous le capot (pour comprendre ou déboguer)

Le moteur (`public/js/app-dynamic.js`) écoute la collection et, pour chaque document :

1. `enabled` passe à `true` → **montage** : rendu du HTML/CSS dans un Shadow DOM,
   insertion dans la zone au bon `order`, exécution du JS.
2. `enabled` passe à `false` ou document supprimé → **démontage** : intervalles
   arrêtés, fonctions `onCleanup` appelées, panneau retiré.
3. `html`, `css`, `js`, `config` ou `type` changent → démontage + remontage
   (c'est la « signature de contenu » qui est comparée).
4. Seuls `zone`/`order` changent → simple déplacement du panneau (le JS continue).

Une erreur dans **votre** JS (au montage ou dans un tick de `ctx.every`) est
attrapée et loguée : elle n'affecte ni les autres composants ni le moteur.

## 6. Débogage

- **Aperçu de l'admin** : exécute votre composant dans une iframe sandbox avec une
  mini-console (logs, erreurs JS, échecs `fetchJson`). Depuis l'admin **locale**
  (`http://<ip>:3000/admin`), l'aperçu appelle les vraies API du Pi ; depuis la
  version hébergée, les appels `/api/...` échouent proprement (normal).
  Le champ à côté de « Aperçu » permet de pointer les URL `/api/...` vers une autre base.
- **Sur le Raspberry** : les erreurs sont dans la console du navigateur, préfixées
  `Custom component '<id>' …`. Pour la voir : quittez le kiosque (clic sur l'horloge)
  et ouvrez `http://localhost:3000/dynamic.html` dans Chromium normal (F12).
- **Rien ne s'affiche ?** Vérifiez : `enabled` à `true` ; zone/ordre corrects ;
  console navigateur ; et que le `type` est bien `custom` (un type inconnu est
  ignoré silencieusement).
- **Connexion refusée alors que le compte existe** (erreur mentionnant
  « blocked ») : la clé API web n'autorise pas Identity Toolkit. Relancez
  `node scripts/setup-auth.js …` (il corrige la clé), ou ajoutez « Identity
  Toolkit API » aux restrictions de la clé dans Google Cloud Console →
  APIs & Services → Credentials.

## 7. Sécurité — à savoir

- Le champ `js` d'un composant custom est **exécuté tel quel sur le dashboard**.
  C'est le but (créer des composants sans redéployer), mais cela signifie que
  **quiconque peut écrire dans Firestore peut exécuter du code sur le Pi**.
  D'où les règles strictes : écriture limitée à votre email, auto-inscription fermée.
- Ne mettez pas de secrets (clés API privées…) dans `html/css/js/config` :
  la collection est lisible publiquement (nécessaire pour le dashboard sans login).
- Le mot de passe admin se change via « Mot de passe oublié ? » sur l'écran de
  connexion, ou dans la console Firebase → Authentication → Users.

## 8. Rappel des commandes

```bash
# Déployer la console d'admin (après modification de admin/)
firebase deploy --only hosting

# Déployer les règles Firestore (après modification de firestore.rules)
firebase deploy --only firestore:rules

# (Re)configurer l'authentification admin
node scripts/setup-auth.js <email> <mot-de-passe>
```

Le dashboard du Raspberry, lui, n'a **jamais** besoin d'être redéployé pour un
composant custom : tout vit dans Firestore.
