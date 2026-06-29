#!/bin/bash
cd /home/admin/Desktop/raspDash/RaspDashboard

# Kill any existing node/server processes to avoid port conflicts
pkill -f "node server.js" 2>/dev/null || true
sleep 1

npm start &
sleep 3
chromium --kiosk http://localhost:3000
