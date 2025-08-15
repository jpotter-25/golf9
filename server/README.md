# Golf 9 Server (optional, for Online/LAN prototype)

## Quick Start (PowerShell)

```powershell
cd C:\dev\golf9\server
npm install
$env:PORT=8080
node index.js
# Ensure your phone/emulator can reach your PC's IP (e.g., 192.168.1.70:8080)
```

The client includes a placeholder to connect via WebSocket (not fully wired by default).
This server simply relays messages between players in a room.