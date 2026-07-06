import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
    getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { BUILTIN_TYPES, CUSTOM_STARTER, SNIPPETS } from "./catalog.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const componentsCol = collection(db, 'components');

const $ = (id) => document.getElementById(id);
const ZONES = ['top', 'left', 'right'];

// id -> data, kept in sync with Firestore
const components = new Map();
let unsubscribe = null;

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------
const AUTH_SETUP_MSG =
    "Firebase Auth n'est pas encore initialisé pour ce projet.\n" +
    "1. Ouvrez la console Firebase → Authentication → « Commencer »\n" +
    "2. Puis lancez : node scripts/setup-auth.js <email> <mot-de-passe>\n" +
    "(voir docs/GUIDE_COMPOSANTS.md)";

const AUTH_ERRORS = {
    'auth/configuration-not-found': AUTH_SETUP_MSG,
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/wrong-password': 'Email ou mot de passe incorrect.',
    'auth/user-not-found': "Aucun utilisateur avec cet email.",
    'auth/too-many-requests': 'Trop de tentatives, réessayez dans quelques minutes.',
    'auth/network-request-failed': 'Erreur réseau — vérifiez votre connexion.',
};

function authErrorMessage(err) {
    const code = err.code || '';
    if (AUTH_ERRORS[code]) return AUTH_ERRORS[code];
    // Auth pas encore configuré : selon l'état du projet, l'API renvoie
    // 'configuration-not-found' ou un code '...-are-blocked'.
    if (code.includes('configuration-not-found') || code.includes('blocked')) return AUTH_SETUP_MSG;
    return `Erreur : ${code || err.message}`;
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        $('login-view').classList.add('hidden');
        $('app-view').classList.remove('hidden');
        $('user-email').textContent = user.email;
        startListening();
    } else {
        $('app-view').classList.add('hidden');
        $('login-view').classList.remove('hidden');
    }
});

$('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('login-error');
    errEl.classList.add('hidden');
    $('login-btn').disabled = true;
    try {
        await signInWithEmailAndPassword(auth, $('login-email').value.trim(), $('login-password').value);
    } catch (err) {
        errEl.textContent = authErrorMessage(err);
        errEl.classList.remove('hidden');
    } finally {
        $('login-btn').disabled = false;
    }
});

$('reset-password-btn').addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const errEl = $('login-error');
    errEl.classList.remove('hidden');
    if (!email) {
        errEl.textContent = "Saisissez d'abord votre email ci-dessus.";
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        errEl.textContent = `Email de réinitialisation envoyé à ${email}.`;
    } catch (err) {
        errEl.textContent = authErrorMessage(err);
    }
});

$('logout-btn').addEventListener('click', () => signOut(auth));

// ------------------------------------------------------------------
// Realtime list
// ------------------------------------------------------------------
function startListening() {
    if (unsubscribe) return;
    unsubscribe = onSnapshot(componentsCol, (snapshot) => {
        components.clear();
        snapshot.forEach((d) => components.set(d.id, d.data()));
        $('sync-status').textContent = `Synchronisé en temps réel — ${components.size} composant(s)`;
        $('sync-status').classList.add('live');
        renderList();
    }, (err) => {
        $('sync-status').textContent = `Erreur Firestore : ${err.code || err.message}`;
        $('sync-status').classList.remove('live');
    });
}

function zoneItems(zone) {
    return [...components.entries()]
        .filter(([, c]) => c.zone === zone)
        .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
}

function displayName(id, c) {
    if (c.name) return c.name;
    if (c.type !== 'custom' && BUILTIN_TYPES[c.type]) return BUILTIN_TYPES[c.type].label;
    return id;
}

function renderList() {
    for (const zone of ZONES) {
        const holder = $(`zone-list-${zone}`);
        holder.innerHTML = '';
        const items = zoneItems(zone);
        if (!items.length) {
            holder.innerHTML = '<div class="zone-empty">Aucun composant dans cette zone</div>';
            continue;
        }
        items.forEach(([id, c], idx) => {
            const card = document.createElement('div');
            card.className = 'comp-card' + (c.enabled ? '' : ' disabled');

            const info = document.createElement('div');
            info.className = 'comp-info';
            const typeLabel = c.type === 'custom' ? 'custom' : c.type;
            info.innerHTML = `
                <div class="comp-name"></div>
                <span class="comp-type ${c.type === 'custom' ? 'custom' : ''}"></span>`;
            info.querySelector('.comp-name').textContent = displayName(id, c);
            info.querySelector('.comp-type').textContent = typeLabel;

            const actions = document.createElement('div');
            actions.className = 'comp-actions';

            const upBtn = iconBtn('▲', 'Monter', () => move(id, -1));
            const downBtn = iconBtn('▼', 'Descendre', () => move(id, +1));
            upBtn.disabled = idx === 0;
            downBtn.disabled = idx === items.length - 1;

            const editBtn = iconBtn('✎', 'Modifier', () => openEditor(id));

            const sw = document.createElement('label');
            sw.className = 'switch';
            sw.title = c.enabled ? 'Désactiver' : 'Activer';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!c.enabled;
            cb.addEventListener('change', () => toggleEnabled(id, cb.checked));
            const slider = document.createElement('span');
            slider.className = 'slider';
            sw.append(cb, slider);

            actions.append(upBtn, downBtn, editBtn, sw);
            card.append(info, actions);
            holder.appendChild(card);
        });
    }
}

function iconBtn(symbol, title, onClick) {
    const b = document.createElement('button');
    b.className = 'icon-btn';
    b.textContent = symbol;
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
}

// ------------------------------------------------------------------
// Writes
// ------------------------------------------------------------------
function reportWriteError(err) {
    console.error(err);
    alert(
        err.code === 'permission-denied'
            ? "Écriture refusée par les règles Firestore.\nVérifiez que vous êtes connecté avec l'email admin autorisé dans firestore.rules."
            : `Erreur d'écriture : ${err.code || err.message}`
    );
}

async function toggleEnabled(id, enabled) {
    try {
        await updateDoc(doc(db, 'components', id), { enabled });
    } catch (err) {
        reportWriteError(err);
        renderList(); // restore switch position
    }
}

async function move(id, dir) {
    const c = components.get(id);
    if (!c) return;
    const items = zoneItems(c.zone);
    const idx = items.findIndex(([itemId]) => itemId === id);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= items.length) return;

    [items[idx], items[swapWith]] = [items[swapWith], items[idx]];
    // Re-number the whole zone: self-healing if orders are duplicated.
    try {
        const batch = writeBatch(db);
        items.forEach(([itemId], i) => batch.update(doc(db, 'components', itemId), { order: i + 1 }));
        await batch.commit();
    } catch (err) {
        reportWriteError(err);
    }
}

function nextOrder(zone) {
    const items = zoneItems(zone);
    return items.length ? Math.max(...items.map(([, c]) => c.order || 0)) + 1 : 1;
}

// ------------------------------------------------------------------
// Picker modal (new component)
// ------------------------------------------------------------------
$('new-component-btn').addEventListener('click', () => {
    renderPicker();
    $('picker-modal').classList.remove('hidden');
});

function renderPicker() {
    const customHolder = $('picker-custom');
    customHolder.innerHTML = '';
    const customCard = document.createElement('button');
    customCard.className = 'type-card t-custom';
    customCard.innerHTML = `
        <span class="t-name">🧩 Composant custom</span>
        <span class="t-desc">Créez votre propre widget avec du HTML, du CSS et du JS, directement depuis cette console. Aucune modification de code sur le Raspberry.</span>`;
    customCard.addEventListener('click', () => {
        $('picker-modal').classList.add('hidden');
        openEditor(null);
    });
    customHolder.appendChild(customCard);

    const holder = $('picker-builtins');
    holder.innerHTML = '';
    const usedTypes = new Set([...components.values()].map((c) => c.type));
    for (const [type, meta] of Object.entries(BUILTIN_TYPES)) {
        const btn = document.createElement('button');
        btn.className = 'type-card';
        const already = usedTypes.has(type);
        btn.disabled = already;
        btn.innerHTML = `
            <span class="t-name"></span>
            <span class="t-desc"></span>`;
        btn.querySelector('.t-name').textContent = meta.label + (already ? ' — déjà présent' : '');
        btn.querySelector('.t-desc').textContent = meta.description;
        btn.addEventListener('click', () => createBuiltin(type, meta));
        holder.appendChild(btn);
    }
}

async function createBuiltin(type, meta) {
    try {
        await addDoc(componentsCol, {
            type,
            name: meta.label,
            zone: meta.defaultZone,
            order: nextOrder(meta.defaultZone),
            enabled: true,
            config: {},
        });
        $('picker-modal').classList.add('hidden');
    } catch (err) {
        reportWriteError(err);
    }
}

// ------------------------------------------------------------------
// Editor modal
// ------------------------------------------------------------------
let editingId = null;   // null => creating a new custom component
let editingType = 'custom';

function openEditor(id) {
    editingId = id;
    const c = id ? components.get(id) : null;
    editingType = c ? c.type : 'custom';

    $('editor-title').textContent = id
        ? `Modifier : ${displayName(id, c)}`
        : 'Nouveau composant custom';

    const src = c || { ...CUSTOM_STARTER, zone: 'left', order: nextOrder('left'), enabled: true, type: 'custom' };
    $('f-name').value = src.name || '';
    $('f-zone').value = src.zone || 'left';
    $('f-order').value = src.order ?? 1;
    $('f-enabled').checked = src.enabled !== false;
    $('f-html').value = src.html || '';
    $('f-css').value = src.css || '';
    $('f-js').value = src.js || '';
    $('f-config').value = JSON.stringify(src.config || {}, null, 2);

    // Built-in components have no code to edit — only name/zone/order/config.
    const isCustom = editingType === 'custom';
    $('code-editors').querySelectorAll('.tab').forEach((t) => {
        const tab = t.dataset.tab;
        t.classList.toggle('hidden', !isCustom && tab !== 'config');
    });
    $('snippet-select').classList.toggle('hidden', !isCustom);
    $('preview-btn').classList.toggle('hidden', !isCustom);
    $('preview-panel').classList.toggle('hidden', !isCustom);
    document.querySelector('.editor-layout').classList.toggle('no-preview', !isCustom);
    selectTab(isCustom ? 'html' : 'config');

    $('delete-btn').classList.toggle('hidden', !id);
    $('editor-error').classList.add('hidden');
    $('preview-console').textContent = '';
    $('preview-frame-holder').innerHTML = '';
    $('editor-modal').classList.remove('hidden');
}

function selectTab(tab) {
    document.querySelectorAll('#editor-tabs .tab').forEach((t) =>
        t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.code-area').forEach((a) =>
        a.classList.toggle('hidden', a.dataset.pane !== tab));
}

document.querySelectorAll('#editor-tabs .tab').forEach((t) =>
    t.addEventListener('click', () => selectTab(t.dataset.tab)));

// Insert 4 spaces on Tab inside the code areas
document.querySelectorAll('.code-area').forEach((area) => {
    area.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        const { selectionStart: s, selectionEnd: end, value } = area;
        area.value = value.slice(0, s) + '    ' + value.slice(end);
        area.selectionStart = area.selectionEnd = s + 4;
    });
});

// Snippets dropdown
for (const snip of SNIPPETS) {
    const opt = document.createElement('option');
    opt.value = snip.id;
    opt.textContent = snip.label;
    $('snippet-select').appendChild(opt);
}

$('snippet-select').addEventListener('change', () => {
    const snip = SNIPPETS.find((s) => s.id === $('snippet-select').value);
    $('snippet-select').value = '';
    if (!snip) return;
    if (($('f-html').value.trim() || $('f-js').value.trim()) &&
        !confirm('Remplacer le contenu actuel par cet exemple ?')) return;
    $('f-name').value = snip.name;
    $('f-html').value = snip.html;
    $('f-css').value = snip.css;
    $('f-js').value = snip.js;
    $('f-config').value = JSON.stringify(snip.config, null, 2);
    selectTab('html');
});

function readEditorForm() {
    let config;
    try {
        config = JSON.parse($('f-config').value.trim() || '{}');
    } catch (err) {
        throw new Error(`Config JSON invalide : ${err.message}`);
    }
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('La config doit être un objet JSON, ex. { "step": 1 }');
    }
    const data = {
        name: $('f-name').value.trim() || 'Sans nom',
        type: editingType,
        zone: $('f-zone').value,
        order: Number($('f-order').value) || 1,
        enabled: $('f-enabled').checked,
        config,
    };
    if (editingType === 'custom') {
        data.html = $('f-html').value;
        data.css = $('f-css').value;
        data.js = $('f-js').value;
    }
    return data;
}

$('save-btn').addEventListener('click', async () => {
    const errEl = $('editor-error');
    errEl.classList.add('hidden');
    try {
        const data = readEditorForm();
        if (editingId) {
            await updateDoc(doc(db, 'components', editingId), data);
        } else {
            await addDoc(componentsCol, data);
        }
        $('editor-modal').classList.add('hidden');
    } catch (err) {
        if (err.code) return reportWriteError(err);
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
    }
});

$('delete-btn').addEventListener('click', async () => {
    if (!editingId) return;
    const c = components.get(editingId);
    if (!confirm(`Supprimer définitivement « ${displayName(editingId, c)} » ?`)) return;
    try {
        await deleteDoc(doc(db, 'components', editingId));
        $('editor-modal').classList.add('hidden');
    } catch (err) {
        reportWriteError(err);
    }
});

document.querySelectorAll('.btn-close').forEach((b) =>
    b.addEventListener('click', () => $(b.dataset.close).classList.add('hidden')));

// ------------------------------------------------------------------
// Preview (sandboxed iframe reproducing the dashboard engine contract)
// ------------------------------------------------------------------
const onHosting = /\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
$('preview-api-base').value = onHosting ? '' : location.origin;

// Serialize a value so it can be embedded inside an inline <script>.
const jsStr = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const ZONE_WIDTHS = { top: 640, left: 280, right: 240 };

function buildPreviewSrcdoc({ html, css, js, config, zone, apiBase }) {
    return `<!DOCTYPE html>
<html><head><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        min-height: 100vh; display: flex; align-items: flex-start; justify-content: center;
        padding: 18px; background: #202225 radial-gradient(400px 200px at 30% 0%, rgba(74,222,128,0.10), transparent);
        font-family: 'Roboto', sans-serif; color: #fff;
    }
    .glass-panel {
        background: rgba(30, 30, 30, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        padding: 10px;
        width: ${ZONE_WIDTHS[zone] || 280}px;
        max-width: 100%;
    }
</style></head>
<body>
<div class="glass-panel widget-custom" id="host"></div>
<script>
(async () => {
    const send = (level, parts) => parent.postMessage({
        raspdashPreview: true, level,
        text: parts.map(p => { try { return typeof p === 'string' ? p : JSON.stringify(p); } catch { return String(p); } }).join(' ')
    }, '*');
    ['log', 'warn', 'error'].forEach(l => { console[l] = (...a) => send(l, a); });
    window.addEventListener('error', (e) => send('error', [e.message]));
    window.addEventListener('unhandledrejection', (e) => send('error', [String(e.reason)]));

    const HTML = ${jsStr(html)};
    const CSS = ${jsStr(css)};
    const JS = ${jsStr(js)};
    const CONFIG = ${jsStr(config)};
    const API_BASE = ${jsStr(apiBase)};

    const shadow = document.getElementById('host').attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>:host { display: block; }\\n' + CSS + '</style>' + HTML;

    const ctx = {
        root: shadow,
        config: CONFIG,
        id: 'preview',
        fetchJson: async (url) => {
            try {
                const target = /^https?:/i.test(url) ? url
                    : (API_BASE ? API_BASE.replace(/\\/$/, '') + url : url);
                const r = await fetch(target);
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return await r.json();
            } catch (e) {
                send('warn', ['fetchJson(' + url + ') a échoué dans l\\u0027aperçu : ' + e.message]);
                return null;
            }
        },
        every(ms, fn) {
            const safe = async () => { try { await fn(); } catch (e) { send('error', [String(e)]); } };
            safe();
            setInterval(safe, ms);
        },
        onCleanup() { },
    };

    try {
        const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        await new AsyncFunction('ctx', '"use strict";\\n' + JS)(ctx);
        send('log', ['✓ Script exécuté sans erreur']);
    } catch (e) {
        send('error', ['Erreur JS : ' + (e.message || e)]);
    }
})();
<\/script>
</body></html>`;
}

window.addEventListener('message', (e) => {
    if (!e.data || !e.data.raspdashPreview) return;
    const line = document.createElement('div');
    line.className = `log-${e.data.level}`;
    line.textContent = `[${e.data.level}] ${e.data.text}`;
    const consoleEl = $('preview-console');
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
});

$('preview-btn').addEventListener('click', () => {
    const errEl = $('editor-error');
    errEl.classList.add('hidden');
    let data;
    try {
        data = readEditorForm();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
        return;
    }
    $('preview-console').textContent = '';
    const holder = $('preview-frame-holder');
    holder.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.srcdoc = buildPreviewSrcdoc({
        html: data.html || '',
        css: data.css || '',
        js: data.js || '',
        config: data.config,
        zone: data.zone,
        apiBase: $('preview-api-base').value.trim(),
    });
    holder.appendChild(iframe);
});
