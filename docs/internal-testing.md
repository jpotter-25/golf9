# Golf 9 Internal Testing Checklist

## Latest Google Play internal build
- Release date: `2026-07-11`
- Package: `us.joinup.golf_9`
- App version: `0.1.0`
- Android versionCode: `34`
- EAS profile: `playtest`
- EAS build ID: `90edcfab-4dac-4760-a643-a05adcf05cd7`
- Source commit: `0f9c737761db187400af03c3af593e77c7eba57c`
- AAB: `https://expo.dev/artifacts/eas/nSDHPgQzY_i5CiMu7VCtfeFxfPsZlmJXvNYVpKMqH9M.aab`

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
