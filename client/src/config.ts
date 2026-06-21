// src/config.ts
// Purpose: Environment-based client configuration for dev, staging, and production.

import { NativeModules } from 'react-native';

const ENV = (process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production')).toLowerCase();
const LOCAL_DEV_SERVER_URL = 'http://192.168.1.70:3001';

function serverUrlForHost(host: string | null) {
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return `http://${host}:3001`;
}

function devServerUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_DEV_SERVER_URL;
  if (explicitUrl) return explicitUrl;

  const scriptURL = NativeModules.SourceCode?.scriptURL;
  const host = typeof scriptURL === 'string' ? scriptURL.match(/^[a-z]+:\/\/([^/:]+)/i)?.[1] : null;
  const inferredUrl = serverUrlForHost(host ?? null);
  if (inferredUrl) return inferredUrl;

  return LOCAL_DEV_SERVER_URL;
}

const URLS: Record<string, string> = {
  development: devServerUrl(),
  staging: process.env.EXPO_PUBLIC_STAGING_SERVER_URL || 'https://games.joinup.us',
  production: process.env.EXPO_PUBLIC_PROD_SERVER_URL || 'https://games.joinup.us',
};

export const APP_ENV = ENV;
export const SERVER_URL = URLS[ENV] || URLS.production;
export const SOCKET_URL = SERVER_URL;
