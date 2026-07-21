# Nine Below Internal Testing Checklist

## Latest Google Play internal build
- Release date: `2026-07-12`
- Package: `us.joinup.golf_9`
- App version: `0.1.0`
- Android versionCode: `38`
- EAS profile: `playtest`
- EAS build ID: `a6c6a5e0-8fa8-4780-957c-2951e8d851c4`
- Source commit: `a4c325aea019eecb3ec40455781755c67039cbba`
- AAB: `https://expo.dev/artifacts/eas/9_ydfUKa7usFhVzpqhxE2fjV100wQ_30jLjrGfZu1uM.aab`

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
- App name: Nine Below.
- Short description: Multiplayer 9-card Golf card game.
- Privacy policy URL, support URL, screenshots, age rating, and data-safety answers must be completed before public release.
