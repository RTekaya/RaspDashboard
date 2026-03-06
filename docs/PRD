Product Requirements Document (PRD)
Project Name: Smart Dashboard Target Platform: Raspberry Pi 4B (7-inch display, landscape, 480px height constraint) Run Environment: 24/7 continuous display

1. Project Overview
The user currently runs MagicMirror² on a small 7-inch screen (often clamped to ~480px high). MagicMirror's rigid region-based layout causes overlapping elements and requires constant CSS wrestling to fit. The objective of this project is to build a modern, lightweight, "from scratch" web dashboard running locally via Node.js on a Raspberry Pi. It will show essential ambient information, optimized perfectly for a small screen with a premium visual design.

2. Target Audience & Use Case
User Personas: A tech-savvy user running a Raspberry Pi 24/7 in their living space.
Use Case: A "glanceable" information hub. The user looks at the screen to check the time, current and forecasted weather, prayer times, a daily dose of spiritual inspiration (Quran verse), and the health of the Raspberry Pi itself.
Interaction Model: Read-only display. No touch interaction is required on a daily basis.
3. Core Features (Widgets)
The dashboard must include the following information widgets:

Clock & Date

Precise hours/minutes (e.g., 14:52).
Clean, localized date (e.g., vendredi, 6 mars 2026).
Weather (OpenMeteo)

Current temperature and icon.
Forecast for today (Max/Min temps) and tomorrow.
Prayer Times (Paris)

List of 5 daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) + Sunrise (Chourouk).
Must highlight the next upcoming prayer.
Calculation method based on the Grande Mosquée de Paris (18° Fajr, 15° Isha).
Random Quran Ayah

Displays a random verse in Arabic script.
Updates periodically (e.g., every 30 seconds or 1 minute).
Raspberry Pi Stats

Live CPU usage percentage.
Live RAM usage percentage.
Random Fullscreen Background

A high-quality wallpaper that fills the entire screen.
Changes periodically (e.g., every 1 hour).
Fades smoothly between images.
4. UI/UX Requirements
Layout Constraints: The layout must be tailored to a wide, short screen (e.g., 800x480 resolution).
Proposed Layout:
Left Side: Clock, Weather, Raspberry Pi Stats (stacked with minimal gaps).
Top Center / Top Bar: Quran Ayah.
Right Side: Prayer Times box.
Visual Design:
Glassmorphism: Widgets should have semi-transparent dark/light glass backgrounds (e.g., background: rgba(30,30,30, 0.6); backdrop-filter: blur(10px);) to ensure text remains legible without completely blocking the wallpaper.
Typography: Clean, sans-serif fonts (e.g., Roboto or Inter) for general text, and a proper Arabic font (e.g., Amiri or Scheherazade) for the Quran verse.
Spacing: Margins and paddings between widgets must be tight (5px to 10px) to maximize the limited vertical space.
Hierarchy: The clock and current temperature should be the largest, most visible elements.
5. Non-Functional Requirements
Performance: The app must run infinitely without memory leaks. The architecture should poll data efficiently (e.g., refreshing weather every 30 mins, clock every second without repainting the whole DOM).
Offline Tolerance: If the internet drops, the dashboard should continue showing the clock, Pi stats, and cached weather/prayer data instead of crashing.
Deployment: Must be easily startable via a single Node.js script (e.g., npm start or PM2).

Comment
⌥⌘M
