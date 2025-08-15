# Golf 9 (Expo client)

## Quick Start (PowerShell)

```powershell
cd C:\dev\golf9\client
# 1) Install Node LTS (>=18) and Expo CLI if not already:
#    npm install -g expo-cli
npm install

# 2) Start in Expo Go
npx expo start --tunnel
# Scan the QR code with Expo Go on your phone or run on Android emulator
```

## Notes
- This client implements full Pass & Play (2–4 players), Solo vs AI (baseline), and a basic UI.
- Online multiplayer requires the server (see ..\server) — optional for now.
- Designed to fit on small screens with dynamic scaling (no scrolling).