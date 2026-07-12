# Golf 9 Internal Testing Checklist

## Latest Google Play internal build
- Release date: `2026-07-12`
- Package: `us.joinup.golf_9`
- App version: `0.1.0`
- Android versionCode: `37`
- EAS profile: `playtest`
- EAS build ID: `d0cff5d6-bf4d-4ca0-a1ab-4835d40bf61d`
- Source commit: `d2453179a960cc564af22b0ee9eca7a3f4e3c44a`
- AAB: `https://expo.dev/artifacts/eas/76LzpJ5x_6-GYfi0wgUY4oU2F20kg6i8O8wfOw-719o.aab`

## Build channels
- iOS TestFlight: `eas build --platform ios --profile staging`
- Android internal testing APK: `eas build --platform android --profile staging`
- Production candidates: `eas build --platform all --profile production`

## Required manual coverage
- Pass-and-play: 2, 3, and 4 players; 5 and 9 rounds.
- Solo AI: 2, 3, and 4 players; 5 and 9 rounds.
- Online rooms: create, join by code, ready/unready, host start, host leave, leave room.
- Online games: 2, 3, and 4 players; reconnect mid-game; close/reopen app during room; player timeout.
- Invalid intents: out-of-turn draw/replace/discard, duplicate action IDs, invalid room code.
- Final sweep, column zeroing, and final scoring.
- iOS, Android, and web smoke tests if web distribution remains enabled.

## Store metadata requirements
- App name: Golf 9.
- Short description: Multiplayer 9-card Golf card game.
- Privacy policy URL, support URL, screenshots, age rating, and data-safety answers must be completed before public release.
