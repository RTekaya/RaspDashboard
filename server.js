const express = require('express');
const NodeCache = require('node-cache');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();
const port = process.env.PORT || 3000;

// Caches config (stdTTL is in seconds)
const weatherCache = new NodeCache({ stdTTL: 1800 }); // 30 mins
const prayerCache = new NodeCache({ stdTTL: 86400 }); // 1 day
const quranCache = new NodeCache({ stdTTL: 3600 }); // 1 hour
const jellyfinCache = new NodeCache({ stdTTL: 300 });
const n8nCache = new NodeCache({ stdTTL: 300 });

app.use(express.json());
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});
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
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=48.864202&longitude=2.486464&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=Europe/Paris';
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

        // Aladhan definition: city=Paris, method=99, settings=18,null,15. 
        // Adding timezone and returning hijri object natively.
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

// Provide a full PATH so systemctl is always found even when
// Node is spawned from a GUI/kiosk environment with a stripped-down PATH.
const EXEC_ENV = {
    ...process.env,
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
};

async function isServiceActive(serviceName) {
    try {
        const { stdout } = await execAsync(
            `systemctl is-active ${serviceName}`,
            { env: EXEC_ENV }
        );
        const result = stdout.trim();
        console.log(`[RaspDash] systemctl is-active ${serviceName} => '${result}'`);
        return result === 'active';
    } catch (err) {
        // systemctl exits with a non-zero code when the service is inactive,
        // but it still writes the status to stdout (e.g. 'inactive', 'failed').
        // We need to check err.stdout before deciding the service is down.
        const result = (err.stdout || '').trim();
        console.error(`[RaspDash] Status check catch for ${serviceName}: code=${err.code}, stdout='${result}', msg=${err.message}`);
        return result === 'active';
    }
}

app.get('/api/jellyfin_status', async (req, res) => {
    const active = await isServiceActive('jellyfin');
    res.json({ active });
});

app.get('/api/n8n_status', async (req, res) => {
    const active = await isServiceActive('n8n');
    res.json({ active });
});

// Debug endpoint: returns raw systemctl output for a service.
// Usage: http://localhost:3000/api/debug_service?name=jellyfin
app.get('/api/debug_service', async (req, res) => {
    const name = req.query.name || 'jellyfin';
    try {
        const { stdout, stderr } = await execAsync(
            `systemctl is-active ${name}`,
            { env: EXEC_ENV }
        );
        res.json({ service: name, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 });
    } catch (err) {
        res.json({
            service: name,
            stdout: (err.stdout || '').trim(),
            stderr: (err.stderr || '').trim(),
            exitCode: err.code,
            message: err.message,
        });
    }
});

app.post('/api/jellyfin_control', async (req, res) => {
    const { action } = req.body;
    try {
        if (action === 'start') {
            await execAsync('sudo systemctl start jellyfin');
            res.json({ success: true });
        } else if (action === 'stop') {
            await execAsync('sudo systemctl stop jellyfin');
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to control Jellyfin' });
    }
});

app.post('/api/n8n_control', async (req, res) => {
    const { action } = req.body;
    try {
        if (action === 'start') {
            await execAsync('sudo systemctl start n8n');
            res.json({ success: true });
        } else if (action === 'stop') {
            await execAsync('sudo systemctl stop n8n');
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to control n8n' });
    }
});

app.get('/api/stats', async (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsagePercent = Math.round((usedMem / totalMem) * 100);
    const cpuUsagePercent = getCpuUsage();

    let diskFree = 'N/A';
    let diskPercent = 0;
    try {
        const { stdout } = await execAsync("df -h / | awk 'NR==2 {print $4, $5}'");
        const parts = stdout.trim().split(/\s+/);
        if (parts.length === 2) {
            diskFree = parts[0];
            diskPercent = parseInt(parts[1].replace('%', ''));
        }
    } catch (e) {
        console.error("Error fetching disk space:", e);
    }

    res.json({
        cpu: cpuUsagePercent,
        ram: ramUsagePercent,
        diskFree: diskFree,
        diskPercent: diskPercent
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
