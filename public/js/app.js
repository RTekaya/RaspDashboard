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
// Background logic
// ------------------------------------------------------------------
let activeBgIndex = 1;

async function updateBackground() {
    // Picsum random landscape image URL
    // Cache bust query to circumvent browser cache
    const randomUrl = `https://picsum.photos/seed/${new Date().getTime()}/800/480`;

    // Fetch image
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

// Update every 5 minutes
setInterval(updateBackground, 5 * 60 * 1000);
updateBackground();

// ------------------------------------------------------------------
// Clock and Date
// ------------------------------------------------------------------
function updateClock() {
    const now = new Date();

    // Time
    const timeString = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('time').innerText = timeString;

    // Date
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateString = now.toLocaleDateString('fr-FR', options);
    document.getElementById('date').innerText = dateString;
}
setInterval(updateClock, 1000);
updateClock();

// Click on Clock to quit the dashboard (return to desktop)
document.querySelector('.widget-clock').addEventListener('click', async () => {
    // Demande de confirmation visuelle (optionnelle mais pratique)
    if (confirm("Voulez-vous quitter le Dashboard et retourner au bureau ?")) {
        try {
            await fetch('/api/quit', { method: 'POST' });
            // Le navigateur devrait être tué par le backend. 
            // S'il n'est pas en kiosk, on tente une méthode classique de secours :
            window.close();
        } catch (err) {
            console.error('Erreur lors de la fermeture:', err);
        }
    }
});

// ------------------------------------------------------------------
// Weather
// ------------------------------------------------------------------
// OpenMeteo WMO codes mapping to emoji/text for simplicity
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
// Update every 30 mins
setInterval(updateWeather, 30 * 60 * 1000);
updateWeather();

// ------------------------------------------------------------------
// Stats CPU & RAM
// ------------------------------------------------------------------
async function updateStats() {
    const data = await fetchJson('/api/stats');
    if (!data) return;

    document.getElementById('cpu-val').innerText = `${data.cpu}%`;
    document.getElementById('cpu-progress').style.width = `${data.cpu}%`;
    // change color if CPU is high
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
// Update every 5 seconds
setInterval(updateStats, 5000);
updateStats();

// ------------------------------------------------------------------
// Random Quran Ayah
// ------------------------------------------------------------------
async function updateQuran() {
    const data = await fetchJson('/api/quran');
    if (!data || data.status !== 'OK') return;

    document.getElementById('quran-text').innerText = data.data.text;
}
// Update every hour
setInterval(updateQuran, 3600 * 1000);
updateQuran();

// ------------------------------------------------------------------
// Prayer Times
// ------------------------------------------------------------------
const prayerKeyMap = {
    'Fajr': 'Fajr',
    'Sunrise': 'Chourouq',
    'Dhuhr': 'Dhuhr',
    'Asr': 'Asr',
    'Maghrib': 'Maghrib',
    'Isha': 'Isha'
};

let currentPrayerData = null;

async function fetchPrayers() {
    const response = await fetchJson('/api/prayers');
    if (!response || response.code !== 200) return;

    // Aladhan returns structure inside .data.timings
    currentPrayerData = response.data.timings;
    renderPrayers();
}

function renderPrayers() {
    if (!currentPrayerData) return;

    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    let nextPrayerId = null;
    let minDiff = Infinity;

    // Ordered list of prayers we care about
    const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    for (const key of order) {
        if (!currentPrayerData[key]) continue;

        const timeStr = currentPrayerData[key]; // HH:mm format

        // Populate the UI text
        const liItem = document.getElementById(`prayer-${key}`);
        if (liItem) {
            liItem.querySelector('.time').innerText = timeStr;
            liItem.classList.remove('next-prayer');
        }

        // Find the next prayer
        if (timeStr > currentTimeStr) {
            // calculate difference
            const diff = timeStr.localeCompare(currentTimeStr);
            if (nextPrayerId === null) {
                nextPrayerId = key;
            }
        }
    }

    // Default to Fajr next day if all prayers today have passed
    if (nextPrayerId === null && order.length > 0) {
        nextPrayerId = 'Fajr';
    }

    // Highlight next prayer
    if (nextPrayerId) {
        const nextLi = document.getElementById(`prayer-${nextPrayerId}`);
        if (nextLi) {
            nextLi.classList.add('next-prayer');
        }
    }
}

// Fetch prayers once a day (or initially), then re-calculate highlight every minute
setInterval(fetchPrayers, 12 * 3600 * 1000); // fetching every 12h to be safe
setInterval(renderPrayers, 60 * 1000);       // check every minute

fetchPrayers();
