// Catalogue of components known by the dashboard engine (public/js/app-dynamic.js).
// A built-in type only supports ONE instance at a time (their DOM ids are global),
// so the picker disables a type that already has a document.

export const BUILTIN_TYPES = {
    clock: {
        label: 'Horloge & date',
        description: 'Heure et date du jour. Un clic sur le panneau propose de quitter le mode kiosque.',
        defaultZone: 'left',
    },
    weather: {
        label: 'Météo',
        description: 'Température actuelle et prévisions (via /api/weather, Open-Meteo).',
        defaultZone: 'left',
    },
    stats: {
        label: 'Stats système',
        description: 'CPU, RAM et espace disque du Raspberry (via /api/stats).',
        defaultZone: 'left',
    },
    quran: {
        label: 'Verset du Coran',
        description: 'Un verset aléatoire, renouvelé chaque heure (via /api/quran).',
        defaultZone: 'top',
    },
    prayers: {
        label: 'Heures de prière',
        description: 'Les six horaires du jour, avec la prochaine prière mise en avant (via /api/prayers).',
        defaultZone: 'right',
    },
    hijri_services: {
        label: 'Date hijri & services',
        description: 'Date hijri, phase de lune et boutons de contrôle Jellyfin / n8n.',
        defaultZone: 'right',
    },
};

// Starter inserted when creating a component from scratch.
export const CUSTOM_STARTER = {
    name: 'Mon composant',
    html: `<div class="hello">
    <div class="title">Bonjour 👋</div>
    <div id="counter">0</div>
</div>`,
    css: `.hello {
    text-align: center;
}

.title {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.8);
}

#counter {
    font-size: 2rem;
    font-weight: 700;
}`,
    js: `// ctx.root   : racine du composant (Shadow DOM) — utilisez ctx.root.querySelector(...)
// ctx.config : l'objet "Config (JSON)" de ce document
// ctx.fetchJson(url)     : GET JSON (renvoie null en cas d'erreur)
// ctx.every(ms, fn)      : exécute fn tout de suite puis toutes les ms millisecondes
// ctx.onCleanup(fn)      : appelé quand le composant est retiré de l'écran

let n = 0;
const el = ctx.root.querySelector('#counter');

ctx.every(1000, () => {
    n += ctx.config.step || 1;
    el.textContent = n;
});`,
    config: { step: 1 },
};

// Ready-made examples available from the editor ("Exemples…" dropdown).
export const SNIPPETS = [
    {
        id: 'btc',
        label: 'Prix du Bitcoin (API externe)',
        name: 'Bitcoin',
        html: `<div class="btc">
    <div class="label">₿ Bitcoin</div>
    <div class="price" id="btc-price">--</div>
</div>`,
        css: `.btc {
    text-align: center;
}

.label {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
}

.price {
    font-size: 1.6rem;
    font-weight: 700;
    color: #facc15;
}`,
        js: `// API publique compatible CORS : appelable directement depuis le dashboard.
const el = ctx.root.querySelector('#btc-price');

ctx.every(ctx.config.refreshMs || 300000, async () => {
    const data = await ctx.fetchJson(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur'
    );
    if (data && data.bitcoin) {
        el.textContent = data.bitcoin.eur.toLocaleString('fr-FR') + ' €';
    }
});`,
        config: { refreshMs: 300000 },
    },
    {
        id: 'cpu',
        label: 'Température CPU (API du Pi)',
        name: 'CPU',
        html: `<div class="cpu">
    <span class="label">CPU</span>
    <span class="value" id="cpu-value">--%</span>
</div>`,
        css: `.cpu {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
}

.label {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
}

.value {
    font-size: 1.4rem;
    font-weight: 700;
}`,
        js: `// Les API locales du Raspberry (/api/...) sont accessibles en URL relative.
const el = ctx.root.querySelector('#cpu-value');

ctx.every(5000, async () => {
    const data = await ctx.fetchJson('/api/stats');
    if (data) {
        el.textContent = data.cpu + '%';
        el.style.color = data.cpu > 80 ? '#ef4444' : '#4ade80';
    }
});`,
        config: {},
    },
    {
        id: 'adhkar',
        label: 'Adhkar en rotation',
        name: 'Adhkar',
        html: `<div class="adhkar">
    <div class="adhkar-text" id="adhkar-text" dir="rtl">…</div>
</div>`,
        css: `.adhkar {
    text-align: center;
}

.adhkar-text {
    font-family: 'Amiri', serif;
    font-size: 1.25rem;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
    transition: opacity 0.4s;
}

.adhkar-text.fade {
    opacity: 0;
}`,
        js: `// La liste vit dans la config : modifiable depuis l'admin sans toucher au code.
const DEFAUT = ['سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ'];
const liste = (Array.isArray(ctx.config.liste) && ctx.config.liste.length) ? ctx.config.liste : DEFAUT;
const el = ctx.root.querySelector('#adhkar-text');
let i = -1;
let pret = false;

// Une seule ligne garantie : réduit la police si le texte est long,
// pour que la hauteur du panneau ne varie jamais (écran 480 px serré).
function afficherTexte(t) {
    el.style.fontSize = '';
    el.textContent = t;
    let taille = 1.25;
    while (el.scrollWidth > el.clientWidth && taille > 0.85) {
        taille -= 0.05;
        el.style.fontSize = taille + 'rem';
    }
}

ctx.every(ctx.config.intervalleMs || 60000, () => {
    i = ctx.config.aleatoire
        ? Math.floor(Math.random() * liste.length)
        : (i + 1) % liste.length;
    if (!pret) {                       // premier affichage : sans fondu
        pret = true;
        afficherTexte(liste[i]);
        return;
    }
    el.classList.add('fade');          // fondu sortant…
    setTimeout(() => {                 // …puis nouveau texte en fondu entrant
        afficherTexte(liste[i]);
        el.classList.remove('fade');
    }, 400);
});`,
        config: {
            intervalleMs: 60000,
            aleatoire: false,
            liste: [
                'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
                'سُبْحَانَ اللَّهِ الْعَظِيمِ',
                'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
                'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ',
                'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ',
                'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
                'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
                'سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَٰهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ',
            ],
        },
    },
    {
        id: 'countdown',
        label: 'Compte à rebours vers une date',
        name: 'Compte à rebours',
        html: `<div class="countdown">
    <div class="cd-title" id="cd-title">Événement</div>
    <div class="cd-days" id="cd-days">--</div>
</div>`,
        css: `.countdown {
    text-align: center;
}

.cd-title {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
}

.cd-days {
    font-size: 1.6rem;
    font-weight: 700;
    color: #93c5fd;
}`,
        js: `ctx.root.querySelector('#cd-title').textContent = ctx.config.title || 'Événement';
const el = ctx.root.querySelector('#cd-days');

ctx.every(3600000, () => {
    const target = new Date(ctx.config.date || '2027-01-01');
    const days = Math.ceil((target - new Date()) / 86400000);
    el.textContent = days > 0 ? 'J-' + days : '🎉';
});`,
        config: { title: 'Nouvel an', date: '2027-01-01' },
    },
];
