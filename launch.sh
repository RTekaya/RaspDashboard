#!/bin/bash
cd /home/admin/Desktop/raspDash/RaspDashboard
npm start &
sleep 3
chromium --kiosk http://localhost:3000
