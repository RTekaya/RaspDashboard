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

function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

document.querySelector('.widget-clock').addEventListener('click', async () => {
    if (confirm("Voulez-vous quitter le Dashboard et retourner au bureau ?")) {
        try {
            await fetch('/api/quit', { method: 'POST' });
            window.close();
        } catch (err) {
            console.error('Erreur lors de la fermeture:', err);
        }
    }
});

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

function startWeather() {
    updateWeather();
    setInterval(updateWeather, 30 * 60 * 1000);
}

// ------------------------------------------------------------------
// Stats CPU & RAM
// ------------------------------------------------------------------
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

function startStats() {
    updateStats();
    setInterval(updateStats, 5000);
}

// ------------------------------------------------------------------
// Random Quran Ayah
// ------------------------------------------------------------------
async function updateQuran() {
    const data = await fetchJson('/api/quran');
    if (!data || data.status !== 'OK') return;

    document.getElementById('quran-text').innerText = data.data.text;

    const surahName = data.data.surah.name;
    const ayahNumber = data.data.numberInSurah;
    const infoDiv = document.getElementById('quran-info');
    if (infoDiv) {
        infoDiv.innerText = `${surahName} - الآية ${ayahNumber}`;
    }
}

function startQuran() {
    updateQuran();
    setInterval(updateQuran, 3600 * 1000);
}

// ------------------------------------------------------------------
// Prayer Times
// ------------------------------------------------------------------
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

    const day = currentHijriData.day;
    const month = currentHijriData.month.ar;
    const year = currentHijriData.year;

    document.getElementById('hijri-date').innerText = `${day} ${month} ${year}`;

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

function startPrayers() {
    fetchPrayers();
    setInterval(fetchPrayers, 12 * 3600 * 1000);
    setInterval(renderPrayers, 60 * 1000);
}

// ------------------------------------------------------------------
// Services Control (Jellyfin & n8n) — combined with Hijri panel
// ------------------------------------------------------------------
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

document.getElementById('jellyfin-btn').addEventListener('click', () => {
    const btn = document.getElementById('jellyfin-btn');
    const isOnline = btn.classList.contains('btn-active');
    const action = isOnline ? 'stop' : 'start';
    btn.innerText = isOnline ? 'Désactivation...' : 'Démarrage...';
    controlService('jellyfin', action);
});

document.getElementById('n8n-btn').addEventListener('click', () => {
    const btn = document.getElementById('n8n-btn');
    const isOnline = btn.classList.contains('btn-active');
    const action = isOnline ? 'stop' : 'start';
    btn.innerText = isOnline ? 'Désactivation...' : 'Démarrage...';
    controlService('n8n', action);
});

function startHijriServices() {
    updateServicesStatus();
    setInterval(updateServicesStatus, 12 * 3600 * 1000);
}

// ------------------------------------------------------------------
// Firebase real-time component toggling
// ------------------------------------------------------------------
const componentState = {
    clock: { el: '.widget-clock', intervalStarted: false, start: startClock },
    weather: { el: '.widget-weather', intervalStarted: false, start: startWeather },
    stats: { el: '.widget-stats', intervalStarted: false, start: startStats },
    quran: { el: '.widget-quran', intervalStarted: false, start: startQuran },
    prayers: { el: '.widget-prayers', intervalStarted: false, start: startPrayers },
    hijri_services: { el: '.widget-hijri-services', intervalStarted: false, start: startHijriServices },
};

function applyComponentVisibility(id, enabled) {
    const c = componentState[id];
    if (!c) return;

    const panel = document.querySelector(c.el);
    if (panel) panel.style.display = enabled ? '' : 'none';

    if (enabled && !c.intervalStarted) {
        c.start();
        c.intervalStarted = true;
    }
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

onSnapshot(collection(db, 'components'), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const enabled = change.doc.data().enabled;
        applyComponentVisibility(id, enabled);
    });
}, (error) => {
    console.error('Firestore listener error:', error);
});
