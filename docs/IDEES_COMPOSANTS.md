# Catalogue d'idées de composants pour RaspDash

Des composants réalistes pour un Raspberry Pi avec écran **800×480** en kiosque.
Chaque idée indique sa source de données et son niveau d'effort. Les quatre
premières sont fournies **prêtes à copier-coller** dans l'admin
(＋ Nouveau composant → Composant custom → coller les 4 blocs).

## Contraintes à garder en tête

- **Zones étroites** : colonne gauche 280 px, droite 240 px, bandeau haut ~780 px.
  Un composant = 2 à 4 lignes de contenu maximum, sinon la colonne déborde.
- **L'écran est déjà bien rempli** : avec les 6 composants de base, la colonne
  droite (prières + hijri/services) n'a plus de place — un 3ᵉ panneau y est rogné
  (vérifié). Pour ajouter : désactivez un composant, ou visez la colonne gauche
  (une petite ligne y tient) ou le bandeau haut.
- **CPU modeste** : pas d'animations permanentes ni de rafraîchissements agressifs
  (≥ 5 s pour le local, ≥ 5 min pour une API externe).
- **API externes** : uniquement HTTPS + CORS ouvert (testez via ▶ Aperçu — un échec
  CORS s'affiche dans la mini-console). Celles citées ici sont vérifiées.
- **Aucun secret** dans html/css/js/config : la collection Firestore est lisible
  publiquement. Une API à clé → passer par un endpoint proxy sur le Pi (catégorie C).

---

## A. Recettes complètes, prêtes à coller

### 1. 🕌 Prochaine prière (compte à rebours)

Complément naturel de la liste des horaires — zone **droite** conseillée.

**HTML**
```html
<div class="np">
    <div class="np-label">Prochaine prière</div>
    <div class="np-name" id="np-name">--</div>
    <div class="np-remain" id="np-remain"></div>
</div>
```

**CSS**
```css
.np { text-align: center; }
.np-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.6); }
.np-name { font-size: 1.3rem; font-weight: 700; color: #facc15; margin: 2px 0; }
.np-remain { font-size: 0.85rem; color: rgba(255,255,255,0.85); }
```

**JS**
```js
const ORDRE = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const nameEl = ctx.root.querySelector('#np-name');
const remainEl = ctx.root.querySelector('#np-remain');
let timings = null;

function afficher() {
    if (!timings) return;
    const now = new Date();
    const mnt = now.getHours() * 60 + now.getMinutes();
    let nom = null, min = null;
    for (const p of ORDRE) {
        const [h, m] = timings[p].split(':').map(Number);
        if (h * 60 + m > mnt) { nom = p; min = h * 60 + m; break; }
    }
    if (!nom) {                            // après Isha → Fajr demain
        const [h, m] = timings.Fajr.split(':').map(Number);
        nom = 'Fajr'; min = h * 60 + m + 1440;
    }
    const diff = min - mnt;
    nameEl.textContent = `${nom} — ${timings[nom]}`;
    remainEl.textContent = diff >= 60
        ? `dans ${Math.floor(diff / 60)} h ${String(diff % 60).padStart(2, '0')} min`
        : `dans ${diff} min`;
}

ctx.every(3600000, async () => {           // horaires : 1×/heure
    const data = await ctx.fetchJson('/api/prayers');
    if (data && data.code === 200) { timings = data.data.timings; afficher(); }
});

ctx.every(30000, afficher);                // compte à rebours : toutes les 30 s
```

**Config** : `{}`

### 2. 📌 Note / pense-bête modifiable à distance

Aucune API. Éditez le texte dans **Config** depuis votre téléphone → il change
sur l'écran instantanément. Parfait pour les messages à la famille.

**HTML**
```html
<div class="note">
    <div class="note-title" id="note-title"></div>
    <div class="note-text" id="note-text"></div>
</div>
```

**CSS**
```css
.note-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 4px; color: #93c5fd; }
.note-text { font-size: 0.9rem; line-height: 1.4; white-space: pre-line; }
```

**JS**
```js
ctx.root.querySelector('#note-title').textContent = ctx.config.titre || '📌 Note';
ctx.root.querySelector('#note-text').textContent = ctx.config.texte || '';
```

**Config**
```json
{ "titre": "📌 À ne pas oublier", "texte": "Arroser les plantes\nRécupérer le colis jeudi" }
```

### 3. 🌬️ Qualité de l'air (indice européen)

Open-Meteo Air Quality — gratuit, sans clé, CORS ouvert (vérifié).

**HTML**
```html
<div class="aq">
    <span class="aq-label">Air</span>
    <span class="aq-badge" id="aq-badge">--</span>
    <span class="aq-pm" id="aq-pm"></span>
</div>
```

**CSS**
```css
.aq { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
.aq-label { color: rgba(255,255,255,0.7); }
.aq-badge { font-weight: 700; padding: 1px 8px; border-radius: 10px; background: rgba(0,0,0,0.3); }
.aq-pm { font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-left: auto; }
```

**JS**
```js
const SEUILS = [[20, 'Bon', '#4ade80'], [40, 'Moyen', '#a3e635'], [60, 'Dégradé', '#facc15'],
                [80, 'Mauvais', '#fb923c'], [100, 'Très mauvais', '#ef4444'], [1e9, 'Extrême', '#a855f7']];
const badge = ctx.root.querySelector('#aq-badge');
const pm = ctx.root.querySelector('#aq-pm');

ctx.every(1800000, async () => {           // 30 min
    const { lat = 48.864202, lon = 2.486464 } = ctx.config;
    const data = await ctx.fetchJson(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5`);
    if (!data || !data.current) return;
    const aqi = data.current.european_aqi;
    const [, label, couleur] = SEUILS.find(([max]) => aqi <= max);
    badge.textContent = `${label} (${aqi})`;
    badge.style.color = couleur;
    pm.textContent = `PM2.5 : ${data.current.pm2_5} µg/m³`;
});
```

**Config** : `{ "lat": 48.864202, "lon": 2.486464 }`

### 4. 💱 Taux de change (ex. EUR → TND)

open.er-api.com — gratuit, sans clé, CORS ouvert (vérifié), mise à jour quotidienne.

**HTML**
```html
<div class="fx"><span class="fx-label" id="fx-label">--</span><span class="fx-val" id="fx-val">--</span></div>
```

**CSS**
```css
.fx { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.95rem; }
.fx-val { font-weight: 700; color: #4ade80; }
```

**JS**
```js
const devise = ctx.config.devise || 'TND';
ctx.root.querySelector('#fx-label').textContent = `1 € en ${devise}`;
const el = ctx.root.querySelector('#fx-val');

ctx.every(6 * 3600000, async () => {       // 4×/jour suffit
    const data = await ctx.fetchJson('https://open.er-api.com/v6/latest/EUR');
    if (data && data.rates && data.rates[devise]) {
        el.textContent = data.rates[devise].toFixed(3);
    }
});
```

**Config** : `{ "devise": "TND" }`

---

## B. Autres idées sans rien changer sur le Pi

| Composant | Données | Zone | Remarques |
|---|---|---|---|
| 🕐 Horloge d'un 2ᵉ fuseau (Tunis…) | aucune — `Intl` avec `timeZone` | gauche | utile l'été : la Tunisie n'a pas d'heure d'été (1 h d'écart avec Paris) |
| 🟢 Statut d'un service systemd (ssh, docker…) | `/api/debug_service?name=<service>` (déjà en place) | droite | pastille verte si `stdout === "active"` ; lecture seule |
| 🌡️ Météo d'une 2ᵉ ville | Open-Meteo direct (CORS ouvert) | gauche | même API que le widget météo, autres coordonnées |
| 🎂 Prochain anniversaire | liste `{nom, date}` dans la config | droite | calcul local du plus proche, « J-12 » |
| 📿 Adhkar / citations en rotation | liste dans la config | haut | `ctx.every(60000)` pour passer au suivant, zéro API |
| 📅 Mini-calendrier du mois | aucune — généré en JS | droite | jour courant surligné ; compact en `font-size: 0.7rem` |
| ₿ Prix crypto | CoinGecko | gauche | déjà dans le menu « Exemples… » de l'admin |
| ⏳ Compte à rebours | config | libre | déjà dans le menu « Exemples… » de l'admin |

## C. Nécessitent un petit endpoint à ajouter dans `server.js`

Le composant reste custom (créé depuis l'admin) ; seul un petit `/api/...` est à
coder côté Pi. **Dites-moi lesquels vous intéressent et je les implémente.**

| Composant | Source sur le Pi | Intérêt |
|---|---|---|
| 🔥 Température du processeur | `vcgencmd measure_temp` ou `/sys/class/thermal` | l'indicateur emblématique d'un Pi ; alerte > 70 °C |
| ⏱️ Uptime + charge système | `os.uptime()`, `os.loadavg()` (Node natif) | trivial à ajouter |
| 📶 Réseau : IP locale, SSID, signal WiFi | `ip addr`, `iwconfig` | pratique quand l'écran est le seul accès au Pi |
| 🌐 Latence Internet | `ping -c1 1.1.1.1` côté serveur | pastille verte/orange/rouge |
| 📦 Mises à jour apt en attente | `apt list --upgradable` (mis en cache 1×/jour) | rappel de maintenance |
| 🏠 Appareils actifs sur le LAN | table ARP / scan périodique | « 7 appareils connectés » ; scan léger à privilégier |
| 🌡️ Température/humidité de la pièce | capteur GPIO (DHT22, BME280…) si présent | transforme le dashboard en station météo intérieure |
| 📰 Fil d'actualités RSS | proxy RSS→JSON côté serveur | les flux RSS n'autorisent pas le CORS, le proxy est obligatoire |

## D. À éviter (et pourquoi)

- **API à clé secrète appelées du navigateur** (Google Agenda, Gmail, Spotify…) :
  la clé serait visible dans Firestore, lisible par tous. Alternative : proxy sur
  le Pi qui garde la clé (catégorie C).
- **iframes de sites** (YouTube, actus…) : la plupart bloquent l'intégration
  (`X-Frame-Options`), et une vidéo met le CPU du Pi à genoux.
- **Animations permanentes** (canvas 60 fps, GIF lourds) : kiosque 24 h/24 =
  usure CPU et chauffe pour rien.
- **Adhan / audio automatique** : faisable, mais Chromium bloque l'autoplay ;
  il faudrait lancer le kiosque avec `--autoplay-policy=no-user-gesture-required`.
  À traiter comme un petit projet à part si vous le voulez.

## Conseils de création

1. Testez toujours via **▶ Aperçu** — depuis l'admin locale
   (`http://<ip-du-pi>:3000/admin`), les URL `/api/...` répondent avec de vraies données.
2. Commencez par la zone **droite** (240 px) : si c'est lisible là, ce sera lisible partout.
3. Tout ce qui peut changer (ville, devise, seuils, textes) → dans **Config**,
   pas en dur dans le JS.
4. Gérez `null` de `fetchJson` : le widget doit survivre à une panne d'API.
