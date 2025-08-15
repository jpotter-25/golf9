// src/config.ts
// Purpose: Central place for environment-like values. Adjust to your LAN IP or server hostname.

export const SERVER_URL = __DEV__ ? 'http://192.168.1.70:3001' : 'https://your-prod-host.example.com';
