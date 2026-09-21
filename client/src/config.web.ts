// Deployed browser games use the same API and Socket.IO origin as /play.
// Development can explicitly point Expo's separate dev server at a local API.
export const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production')).toLowerCase();
const origin = typeof globalThis.location === 'object' ? globalThis.location.origin : 'https://ninebelow.potterwell.com';
export const SERVER_URL = __DEV__ ? process.env.EXPO_PUBLIC_DEV_SERVER_URL || 'http://localhost:3001' : origin;
export const SOCKET_URL = SERVER_URL;
export const SOCIAL_AUTH_CONFIG = {
  googleWebClientId: '',
  facebookAppId: '',
  facebookClientToken: '',
};
