# Nine Below Internal Testing Checklist

## Previous Google Play internal build
- Release date: `2026-07-21`
- Package: `us.joinup.golf_9`
- App version: `0.1.0`
- Android versionCode: `44`
- EAS profile: `playtest`
- EAS build ID: `331fc5dc-1c4e-4a18-8000-654f6cabe310`
- Source commit: `616324cf19087aacc708feb3f68267cb1a7c9fed`
- AAB: `https://expo.dev/artifacts/eas/aQvGk08ZPWJhLF_NISZ9YA5r5xESLumHfYI0uvOh5SU.aab`

## Nine Below package migration
- New package: `com.potterwell.ninebelow`
- App version: `0.1.0`
- Next Android versionCode: `45`
- Play Console requirement: publish as a new app because Google Play package names are immutable.
- Keep the previous `us.joinup.golf_9` listing available as a rollback path; do not upload new-package bundles to it.

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
