import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Utils
async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

function elFromHTML(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
}

// ------------------------------------------------------------------
// Background logic (always on, not gated by Firestore)
// ------------------------------------------------------------------
let activeBgIndex = 1;

async function updateBackground() {
    const randomUrl = `https://picsum.photos/seed/${new Date().getTime()}/800/480`;

    const bg1 = document.getElementById('bg1');
    const bg2 = document.getElementById('bg2');

    const newBg = activeBgIndex === 1 ? bg2 : bg1;
    const oldBg = activeBgIndex === 1 ? bg1 : bg2;

    newBg.onload = () => {
        newBg.classList.add('active');
        oldBg.classList.remove('active');
        activeBgIndex = activeBgIndex === 1 ? 2 : 1;
    };
    newBg.src = randomUrl;
}

setInterval(updateBackground, 5 * 60 * 1000);
updateBackground();

// ------------------------------------------------------------------
// Clock and Date
// ------------------------------------------------------------------
function renderClockTemplate() {
    const el = elFromHTML(`
        <div class="glass-panel widget-clock">
            <div id="time">--:--</div>
            <div id="date">Chargement...</div>
        </div>
    `);
    el.addEventListener('click', async () => {
        if (confirm("Voulez-vous quitter le Dashboard et retourner au bureau ?")) {
            try {
                await fetch('/api/quit', { method: 'POST' });
                window.close();
            } catch (err) {
                console.error('Erreur lors de la fermeture:', err);
            }
        }
    });
    return el;
}

function updateClock() {
    const now = new Date();

    const timeString = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('time').innerText = timeString;

    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateString = now.toLocaleDateString('fr-FR', options);
    document.getElementById('date').innerText = dateString;
}

function startClockInto(ctx) {
    updateClock();
    ctx.intervals.push(setInterval(updateClock, 1000));
}

// ------------------------------------------------------------------
// Weather
// ------------------------------------------------------------------
const wmoCodes = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
    45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌧️',
    61: '🌧️', 63: '🌧️', 65: '⛈️',
    71: '🌨️', 73: '🌨️', 75: '❄️',
    95: '⛈️', 96: '⛈️', 99: '⛈️'
};

function renderWeatherTemplate() {
    return elFromHTML(`
        <div class="glass-panel widget-weather">
            <div class="weather-current">
                <span id="weather-icon">--</span>
                <span id="current-temp">--°</span>
            </div>
            <div id="weather-forecast">Max: --° | Min: --°</div>
        </div>
    `);
}

async function updateWeather() {
    const data = await fetchJson('/api/weather');
    if (!data) return;

    const currentTemp = Math.round(data.current_weather.temperature);
    const weatherCode = data.current_weather.weathercode;
    const maxTemp = Math.round(data.daily.temperature_2m_max[0]);
    const minTemp = Math.round(data.daily.temperature_2m_min[0]);
    const maxTemp2 = Math.round(data.daily.temperature_2m_max[1]);
    const minTemp2 = Math.round(data.daily.temperature_2m_min[1]);

    const icon = wmoCodes[weatherCode] || '🌤️';

    document.getElementById('current-temp').innerText = `${currentTemp}°C`;
    document.getElementById('weather-icon').innerText = icon;
    document.getElementById('weather-forecast').innerHTML = `Auj: Max ${maxTemp}° | Min ${minTemp}°<br>Dem: Max ${maxTemp2}° | Min ${minTemp2}°`;
}

function startWeatherInto(ctx) {
    updateWeather();
    // NB : le cache serveur de /api/weather reste de 30 min.
    ctx.intervals.push(setInterval(updateWeather, ctx.config.intervalleMs || 30 * 60 * 1000));
}

// ------------------------------------------------------------------
// Stats CPU & RAM
// ------------------------------------------------------------------
function renderStatsTemplate() {
    return elFromHTML(`
        <div class="glass-panel widget-stats">
            <div class="stat-item">
                <span>CPU</span>
                <div class="progress-bar">
                    <div class="progress" id="cpu-progress"></div>
                </div>
                <span id="cpu-val" class="stat-val">--%</span>
            </div>
            <div class="stat-item">
                <span>RAM</span>
                <div class="progress-bar">
                    <div class="progress" id="ram-progress"></div>
                </div>
                <span id="ram-val" class="stat-val">--%</span>
            </div>
            <div class="stat-item">
                <span>DISK</span>
                <div class="progress-bar">
                    <div class="progress" id="disk-progress"></div>
                </div>
                <span id="disk-val" class="stat-val">--</span>
            </div>
        </div>
    `);
}

async function updateStats() {
    const data = await fetchJson('/api/stats');
    if (!data) return;

    document.getElementById('cpu-val').innerText = `${data.cpu}%`;
    document.getElementById('cpu-progress').style.width = `${data.cpu}%`;
    document.getElementById('cpu-progress').style.backgroundColor = data.cpu > 80 ? '#ef4444' : '#4ade80';

    document.getElementById('ram-val').innerText = `${data.ram}%`;
    document.getElementById('ram-progress').style.width = `${data.ram}%`;
    document.getElementById('ram-progress').style.backgroundColor = data.ram > 80 ? '#ef4444' : '#4ade80';

    if (data.diskFree && data.diskFree !== 'N/A') {
        const freeDisplay = data.diskFree.replace('Gi', 'G').replace('G', 'Go').replace('Mi', 'M').replace('M', 'Mo');
        document.getElementById('disk-val').innerText = `Libre\n${freeDisplay}`;
        document.getElementById('disk-progress').style.width = `${data.diskPercent}%`;
        document.getElementById('disk-progress').style.backgroundColor = data.diskPercent > 80 ? '#ef4444' : '#4ade80';
    } else {
        document.getElementById('disk-val').innerText = `--`;
    }
}

function startStatsInto(ctx) {
    updateStats();
    ctx.intervals.push(setInterval(updateStats, ctx.config.intervalleMs || 5000));
}

// ------------------------------------------------------------------
// Random Quran Ayah
// ------------------------------------------------------------------
function renderQuranTemplate() {
    return elFromHTML(`
        <div class="glass-panel widget-quran">
            <div id="quran-text" dir="rtl" class="arabic-text">Chargement du verset...</div>
            <div id="quran-info" dir="rtl" class="quran-info"></div>
        </div>
    `);
}

async function updateQuran(maxAgeSec = 3600) {
    const data = await fetchJson(`/api/quran?maxAgeSec=${maxAgeSec}`);
    if (!data || data.status !== 'OK') return;

    document.getElementById('quran-text').innerText = data.data.text;

    const surahName = data.data.surah.name;
    const ayahNumber = data.data.numberInSurah;
    const infoDiv = document.getElementById('quran-info');
    if (infoDiv) {
        infoDiv.innerText = `${surahName} - الآية ${ayahNumber}`;
    }
}

function startQuranInto(ctx) {
    // config.intervalleMs : temps entre deux versets (défaut 1 h). Le serveur
    // aligne la fraîcheur de son cache sur cet intervalle (plancher 60 s).
    const intervalMs = Math.max(60 * 1000, ctx.config.intervalleMs || 3600 * 1000);
    const maxAgeSec = Math.round(intervalMs / 1000);
    const tick = () => updateQuran(maxAgeSec);
    tick();
    ctx.intervals.push(setInterval(tick, intervalMs));
}

// ------------------------------------------------------------------
// Prayer Times
// ------------------------------------------------------------------
function renderPrayersTemplate() {
    return elFromHTML(`
        <div class="glass-panel widget-prayers">
            <h2 class="prayers-title">Heures de Prière</h2>
            <ul id="prayer-list">
                <li id="prayer-Fajr"><span class="name">Fajr</span><span class="time">--:--</span></li>
                <li id="prayer-Sunrise"><span class="name">Chourouq</span><span class="time">--:--</span></li>
                <li id="prayer-Dhuhr"><span class="name">Dhuhr</span><span class="time">--:--</span></li>
                <li id="prayer-Asr"><span class="name">Asr</span><span class="time">--:--</span></li>
                <li id="prayer-Maghrib"><span class="name">Maghrib</span><span class="time">--:--</span></li>
                <li id="prayer-Isha"><span class="name">Isha</span><span class="time">--:--</span></li>
            </ul>
        </div>
    `);
}

let currentPrayerData = null;
let currentHijriData = null;

async function fetchPrayers() {
    const response = await fetchJson('/api/prayers');
    if (!response || response.code !== 200) return;

    currentPrayerData = response.data.timings;
    currentHijriData = response.data.date.hijri;

    renderPrayers();
    renderHijri();
}

function renderHijri() {
    if (!currentHijriData) return;
    const hijriEl = document.getElementById('hijri-date');
    if (!hijriEl) return;

    const day = currentHijriData.day;
    const month = currentHijriData.month.ar;
    const year = currentHijriData.year;

    hijriEl.innerText = `${day} ${month} ${year}`;

    const d = parseInt(day, 10);
    let moonEmoji = '🌑';

    if (d >= 2 && d <= 6) moonEmoji = '🌒';
    else if (d >= 7 && d <= 9) moonEmoji = '🌓';
    else if (d >= 10 && d <= 13) moonEmoji = '🌔';
    else if (d >= 14 && d <= 16) moonEmoji = '🌕';
    else if (d >= 17 && d <= 20) moonEmoji = '🌖';
    else if (d >= 21 && d <= 23) moonEmoji = '🌗';
    else if (d >= 24 && d <= 28) moonEmoji = '🌘';

    document.getElementById('moon-phase').innerText = moonEmoji;
}

function renderPrayers() {
    if (!currentPrayerData) return;
    if (!document.getElementById('prayer-list')) return;

    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    let nextPrayerId = null;

    const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    for (const key of order) {
        if (!currentPrayerData[key]) continue;

        const timeStr = currentPrayerData[key];

        const liItem = document.getElementById(`prayer-${key}`);
        if (liItem) {
            liItem.querySelector('.time').innerText = timeStr;
            liItem.classList.remove('next-prayer');
        }

        if (timeStr > currentTimeStr && nextPrayerId === null) {
            nextPrayerId = key;
        }
    }

    if (nextPrayerId === null && order.length > 0) {
        nextPrayerId = 'Fajr';
    }

    if (nextPrayerId) {
        const nextLi = document.getElementById(`prayer-${nextPrayerId}`);
        if (nextLi) {
            nextLi.classList.add('next-prayer');
        }
    }
}

function startPrayersInto(ctx) {
    fetchPrayers();
    ctx.intervals.push(setInterval(fetchPrayers, ctx.config.intervalleMs || 12 * 3600 * 1000));
    ctx.intervals.push(setInterval(renderPrayers, 60 * 1000));
}

// ------------------------------------------------------------------
// Hijri date + Services Control (Jellyfin & n8n) — combined panel
// ------------------------------------------------------------------
function renderHijriServicesTemplate() {
    const el = elFromHTML(`
        <div class="glass-panel widget-hijri-services">
            <div class="hijri-row">
                <div id="moon-phase">🌕</div>
                <div id="hijri-date" dir="rtl" class="arabic-text">Chargement...</div>
            </div>
            <div class="services-row">
                <div class="service-item" id="service-jellyfin">
                    <div class="service-header">
                        <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                        <span class="service-name">Jellyfin</span>
                    </div>
                    <span class="service-status-text" id="jellyfin-status">...</span>
                    <button class="service-btn" id="jellyfin-btn" data-service="jellyfin">Démarrer</button>
                </div>
                <div class="service-item" id="service-n8n">
                    <div class="service-header">
                        <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                        <span class="service-name">n8n</span>
                    </div>
                    <span class="service-status-text" id="n8n-status">...</span>
                    <button class="service-btn" id="n8n-btn" data-service="n8n">Démarrer</button>
                </div>
            </div>
        </div>
    `);

    el.querySelector('#jellyfin-btn').addEventListener('click', () => {
        const btn = el.querySelector('#jellyfin-btn');
        const isOnline = btn.classList.contains('btn-active');
        const action = isOnline ? 'stop' : 'start';
        btn.innerText = isOnline ? 'Désactivation...' : 'Démarrage...';
        controlService('jellyfin', action);
    });

    el.querySelector('#n8n-btn').addEventListener('click', () => {
        const btn = el.querySelector('#n8n-btn');
        const isOnline = btn.classList.contains('btn-active');
        const action = isOnline ? 'stop' : 'start';
        btn.innerText = isOnline ? 'Désactivation...' : 'Démarrage...';
        controlService('n8n', action);
    });

    return el;
}

async function updateServicesStatus() {
    const jellyfinData = await fetchJson(`/api/jellyfin_status?_=${Date.now()}`);
    const jellyfinStatusText = document.getElementById('jellyfin-status');
    const jellyfinBtn = document.getElementById('jellyfin-btn');

    if (jellyfinData && jellyfinStatusText && jellyfinBtn) {
        if (jellyfinData.active) {
            jellyfinStatusText.innerText = 'En ligne';
            jellyfinStatusText.className = 'service-status-text online';
            jellyfinBtn.innerText = 'Désactiver';
            jellyfinBtn.classList.add('btn-active');
        } else {
            jellyfinStatusText.innerText = 'Hors ligne';
            jellyfinStatusText.className = 'service-status-text offline';
            jellyfinBtn.innerText = 'Démarrer';
            jellyfinBtn.classList.remove('btn-active');
        }
    }

    const n8nData = await fetchJson(`/api/n8n_status?_=${Date.now()}`);
    const n8nStatusText = document.getElementById('n8n-status');
    const n8nBtn = document.getElementById('n8n-btn');

    if (n8nData && n8nStatusText && n8nBtn) {
        if (n8nData.active) {
            n8nStatusText.innerText = 'En ligne';
            n8nStatusText.className = 'service-status-text online';
            n8nBtn.innerText = 'Désactiver';
            n8nBtn.classList.add('btn-active');
        } else {
            n8nStatusText.innerText = 'Hors ligne';
            n8nStatusText.className = 'service-status-text offline';
            n8nBtn.innerText = 'Démarrer';
            n8nBtn.classList.remove('btn-active');
        }
    }
}

async function controlService(service, action) {
    try {
        const response = await fetch(`/api/${service}_control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action })
        });
        if (response.ok) {
            setTimeout(updateServicesStatus, 1500);
        } else {
            console.error(`Failed to control ${service}`);
            updateServicesStatus();
        }
    } catch (error) {
        console.error(`Error controlling ${service}:`, error);
        updateServicesStatus();
    }
}

function startHijriServicesInto(ctx) {
    updateServicesStatus();
    ctx.intervals.push(setInterval(updateServicesStatus, ctx.config.intervalleMs || 12 * 3600 * 1000));
}

// ------------------------------------------------------------------
// Custom components (defined entirely in Firestore: html + css + js)
// ------------------------------------------------------------------
// The markup and styles live in a Shadow DOM so a custom component can
// never break the dashboard's own CSS (and two instances can't collide).
function renderCustomTemplate(data) {
    const el = document.createElement('div');
    el.className = 'glass-panel widget-custom';
    const shadow = el.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>:host { display: block; }\n${data.css || ''}</style>${data.html || ''}`;
    return { el, root: shadow };
}

function startCustomInto(ctx, data) {
    const code = (data.js || '').trim();
    if (!code) return;

    const api = {
        root: ctx.root,
        config: ctx.config,
        id: ctx.id,
        fetchJson,
        every(ms, fn) {
            const safeCall = async () => {
                try { await fn(); } catch (err) { console.error(`Custom component '${ctx.id}' tick error:`, err); }
            };
            safeCall();
            ctx.intervals.push(setInterval(safeCall, ms));
        },
        onCleanup(fn) {
            ctx.cleanups.push(fn);
        },
    };

    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    const fn = new AsyncFunction('ctx', `"use strict";\n${code}`);
    // Async errors must not take down the engine — log and keep going.
    Promise.resolve(fn(api)).catch((err) => {
        console.error(`Custom component '${ctx.id}' error:`, err);
    });
}

// ------------------------------------------------------------------
// Generic component engine
// ------------------------------------------------------------------
const componentRegistry = {
    clock: { render: renderClockTemplate, start: startClockInto },
    weather: { render: renderWeatherTemplate, start: startWeatherInto },
    stats: { render: renderStatsTemplate, start: startStatsInto },
    quran: { render: renderQuranTemplate, start: startQuranInto },
    prayers: { render: renderPrayersTemplate, start: startPrayersInto },
    hijri_services: { render: renderHijriServicesTemplate, start: startHijriServicesInto },
    custom: { render: renderCustomTemplate, start: startCustomInto },
};

const zoneContainers = {
    top: document.getElementById('zone-top'),
    left: document.getElementById('zone-left'),
    right: document.getElementById('zone-right'),
};

const mountedInstances = new Map(); // id -> { type, zone, order, sig, el, intervals, cleanups }

// Everything that requires a re-render when it changes (as opposed to
// zone/order, which only require moving the existing element).
function contentSignature(data) {
    return JSON.stringify([
        data.type,
        data.html || '',
        data.css || '',
        data.js || '',
        data.config || {},
    ]);
}

function insertInOrder(el, zone, order) {
    el.dataset.order = order;
    const container = zoneContainers[zone];
    if (!container) return;
    const siblings = Array.from(container.children);
    const next = siblings.find((sib) => Number(sib.dataset.order) > order);
    container.insertBefore(el, next || null);
}

function mount(id, data) {
    const entry = componentRegistry[data.type];
    if (!entry) return; // unknown type: not yet implemented, skip silently

    const rendered = entry.render(data);
    const el = rendered.el || rendered;
    const root = rendered.root || el; // custom components expose their shadow root
    el.dataset.instanceId = id;

    // Attach to the document before starting the update loop: synchronous
    // renderers (e.g. clock) touch the DOM immediately and would otherwise
    // hit a detached node.
    insertInOrder(el, data.zone, data.order);

    const ctx = { id, root, config: data.config || {}, intervals: [], cleanups: [] };
    entry.start(ctx, data);

    mountedInstances.set(id, {
        type: data.type,
        zone: data.zone,
        order: data.order,
        sig: contentSignature(data),
        el,
        intervals: ctx.intervals,
        cleanups: ctx.cleanups,
    });
}

function unmount(id) {
    const inst = mountedInstances.get(id);
    if (!inst) return;
    inst.intervals.forEach(clearInterval);
    inst.cleanups.forEach((fn) => {
        try { fn(); } catch (err) { console.error(`Cleanup error for '${id}':`, err); }
    });
    inst.el.remove();
    mountedInstances.delete(id);
}

function reposition(id, zone, order) {
    const inst = mountedInstances.get(id);
    if (!inst) return;
    inst.zone = zone;
    inst.order = order;
    insertInOrder(inst.el, zone, order);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

onSnapshot(collection(db, 'components'), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        try {
            if (change.type === 'removed') {
                unmount(id);
                return;
            }

            const data = change.doc.data();
            const wasMounted = mountedInstances.has(id);
            const shouldMount = !!data.enabled && !!componentRegistry[data.type];

            if (wasMounted && !shouldMount) {
                unmount(id);
            } else if (!wasMounted && shouldMount) {
                mount(id, data);
            } else if (wasMounted && shouldMount) {
                const inst = mountedInstances.get(id);
                if (inst.sig !== contentSignature(data)) {
                    // type, html, css, js or config changed: full re-render, so a
                    // custom component edited from the admin updates live.
                    unmount(id);
                    mount(id, data);
                } else if (inst.zone !== data.zone || inst.order !== data.order) {
                    reposition(id, data.zone, data.order);
                }
                // otherwise nothing relevant changed — leave the instance's intervals running
            }
        } catch (err) {
            // A broken instance/type must not prevent the rest of the
            // collection from mounting.
            console.error(`Component engine error for '${id}':`, err);
        }
    });
}, (error) => {
    console.error('Firestore listener error:', error);
});
