Technical Requirements Document (TRD)
Project Name: Custom Node.js Smart Dashboard Tech Stack Proposed:

Backend API Server: Node.js with Express.js (or simple HTTP module).
Frontend UI: Vanilla HTML/CSS/JS (or a lightweight framework like Vue/Svelte if preferred).
Process Manager: PM2 (for auto-restarting on the Pi).
1. System Architecture
This project drops the heavy, DOM-manipulating framework of MagicMirror in favor of a clean, separation-of-concerns architecture.

Backend (Node.js): Acts purely as an API Gateway and generic fetcher to avoid CORS issues on the client and hide API keys (if any). It holds a cache in memory to prevent exceeding rate limits when the frontend polls.
Frontend (Browser): A single 
index.html
 file with structured div blocks. The JS fetches data from the local Node server via standard fetch() or WebSockets, and uses standard DOM updates (or reactivity) to render numbers and strings.
2. API Aggregation Layer (Node.js Backend)
The backend must expose the following routes locally (e.g., http://localhost:3000/api/...):

2.1 /api/weather
Source: https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min
Cache: Update every 30-60 minutes.
Payload: Returns a JSON object with { current: { temp, iconCode }, daily: [ { date, maxTemp, minTemp, iconCode }, ... ] }.
2.2 /api/prayers
Source: http://api.aladhan.com/v1/timingsByCity
Params: city=Paris, country=France, method=99, methodSettings=18,null,15
Cache: Update once a day at midnight.
Payload: Returns a JSON array of { name: "Fajr", time: "05:38" }...
2.3 /api/quran
Source: https://api.alquran.cloud/v1/ayah/random
Cache: Update every minute or pull a batch of 10-20 to rotate locally on the frontend.
Payload: Returns { text: "...", surah: "...", number: 12 }.
2.4 /api/stats
Source: Local OS integration using Node.js built-ins.
Implementation: Use libraries like os-utils or parse /proc/stat and /proc/meminfo directly.
Payload: Returns { cpu: "10%", ram: "98%" } in real-time.
3. Frontend Architecture (Vanilla JS or Framework)
3.1 Layout Engine (CSS Grid/Flexbox)
Container: 100vw / 100vh strictly overflow: hidden;
Background Layer (z-index: 0): An img or div spanning the full width and height with object-fit: cover;. Periodically changes its src to something like https://source.unsplash.com/random/800x480/?nature,landscape or local pics.
Widgets Layer (z-index: 10):
Designed using CSS Grid or Flexbox to place items bottom-left, top-right, etc.
Sizing must be absolute/relative tailored specifically for 480px height constraints. Font sizes should range between 14px (stats) and 45px (current time).
3.2 State & Rendering Updates
The frontend should implement a "poll and update" logic:

setInterval(updateClock, 1000) (calculates time locally on the client).
setInterval(fetchWeather, 30 * 60 * 1000) (calls /api/weather and updates DOM).
setInterval(fetchPiStats, 5000) (calls /api/stats and updates DOM).
3.3 Visual Themes (CSS Tokens)
All modules should share CSS variables for spacing, blur, and border colors to create a unified glassmorphism aesthetic.
css
:root {
  --glass-bg: rgba(30,30,30, 0.4);
  --glass-border: rgba(255, 255, 255, 0.1);
  --text-primary: #ffffff;
  --text-highlight: #ffd700;
}
4. Raspberry Pi Deployment & Kiosk Mode
To run this 24/7 on the Pi seamlessly:

Boot the Pi into desktop auto-login.
Launch the Node server via pm2 start server.js.
Launch Chromium in Kiosk mode pointing to localhost:3000: chromium-browser --kiosk --incognito --disable-pinch --overscroll-history-navigation=0 http://localhost:3000
Disable screen sleep using xset commands in the autostart config.

