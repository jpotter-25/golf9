// src/config.ts
// Purpose: Environment-based client configuration for dev, staging, and production.

const ENV = (process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production')).toLowerCase();

const URLS: Record<string, string> = {
  development: process.env.EXPO_PUBLIC_DEV_SERVER_URL || 'http://localhost:3001',
  staging: process.env.EXPO_PUBLIC_STAGING_SERVER_URL || 'https://staging-api.golf9.example.com',
  production: process.env.EXPO_PUBLIC_PROD_SERVER_URL || 'https://api.golf9.example.com',
};

export const APP_ENV = ENV;
export const SERVER_URL = URLS[ENV] || URLS.production;
export const SOCKET_URL = SERVER_URL;
