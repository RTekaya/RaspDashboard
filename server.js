const express = require('express');
const NodeCache = require('node-cache');
const path = require('path');
const os = require('os');

const app = express();
const port = process.env.PORT || 3000;

// Caches config (stdTTL is in seconds)
const weatherCache = new NodeCache({ stdTTL: 1800 }); // 30 mins
const prayerCache = new NodeCache({ stdTTL: 86400 }); // 1 day
const quranCache = new NodeCache({ stdTTL: 3600 }); // 1 hour

app.use(express.static(path.join(__dirname, 'public')));

// Helpers CPU Calculation
let previousCpuTime = { idle: 0, total: 0 };
function getCpuUsage() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
        for (const type in cpu.times) {
            total += cpu.times[type];
        }
        idle += cpu.times.idle;
    }

    if (previousCpuTime.total === 0) {
        previousCpuTime = { idle, total };
        return 0;
    }

    const idleDiff = idle - previousCpuTime.idle;
    const totalDiff = total - previousCpuTime.total;
    const percentage = 100 - ~~(100 * idleDiff / totalDiff);

    previousCpuTime = { idle, total };
    return percentage;
}

// Routes API

app.get('/api/weather', async (req, res) => {
    try {
        const cacheKey = 'weather';
        if (weatherCache.has(cacheKey)) return res.json(weatherCache.get(cacheKey));

        // Coordinates for Paris by default (from PRD)
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=Europe/Paris';
        const response = await fetch(url);
        const data = await response.json();

        weatherCache.set(cacheKey, data);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch weather' });
    }
});

app.get('/api/prayers', async (req, res) => {
    try {
        const cacheKey = 'prayers';
        if (prayerCache.has(cacheKey)) return res.json(prayerCache.get(cacheKey));

        // Aladhan definition: city=Paris, method=99, settings=18,null,15
        const url = 'http://api.aladhan.com/v1/timingsByCity?city=Paris&country=France&method=99&methodSettings=18,null,15';
        const response = await fetch(url);
        const data = await response.json();

        prayerCache.set(cacheKey, data);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch prayer times' });
    }
});

app.get('/api/quran', async (req, res) => {
    try {
        const cacheKey = 'quran';
        if (quranCache.has(cacheKey)) return res.json(quranCache.get(cacheKey));

        // Pick random verse 1 to 6236
        const randomAyah = Math.floor(Math.random() * 6236) + 1;
        const url = `http://api.alquran.cloud/v1/ayah/${randomAyah}/ar.alafasy`;

        const response = await fetch(url);
        const data = await response.json();

        quranCache.set(cacheKey, data);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch random Ayah' });
    }
});

app.get('/api/stats', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsagePercent = Math.round((usedMem / totalMem) * 100);
    const cpuUsagePercent = getCpuUsage();

    res.json({
        cpu: cpuUsagePercent,
        ram: ramUsagePercent
    });
});

app.post('/api/quit', (req, res) => {
    res.json({ message: 'Exiting...' });
    // On exécute la commande pour fermer Chromium (Raspberry Pi OS utilise souvent chromium-browser)
    const { exec } = require('child_process');
    exec('killall chromium-browser || killall chromium', (error) => {
        if (error) {
            console.error("Erreur lors de la fermeture du navigateur:", error);
        }
        // Optionnel : fermer le serveur Node.js aussi
        // process.exit(0); 
    });
});

app.listen(port, () => {
    console.log(`Serveur RaspDash démarré sur http://localhost:${port}`);
});
