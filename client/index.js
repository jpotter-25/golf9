// Entry file to satisfy Expo's default expectations.
// --- Polyfill for structuredClone (Hermes/Android) ---------------------------
if (typeof global.structuredClone !== 'function') {
  // NOTE: This JSON-based clone is fine for our GameState (plain objects/arrays).
  // It won't preserve Dates/Maps/Functions, which we don't use here.
  global.structuredClone = (obj) => {
    if (obj === undefined) return obj;
    return JSON.parse(JSON.stringify(obj));
  };
}
// -----------------------------------------------------------------------------

import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
