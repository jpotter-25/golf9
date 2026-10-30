# Mobile social login rollout — October 30, 2026

## Status and scope

Implemented in source: Google and Facebook on iOS, Sign in with Apple on iOS and Android, account linking, fresh-provider verification for deletion, and Apple token revocation. Browser login remains Nine Below display name/password. All platforms still use the same player database and authoritative game server.

**This is not a released mobile build.** Source reserves iOS build **3** and Android versionCode **60**; do not tell testers these are available until EAS/Apple/Google processing and physical-device verification complete. The previously distributed iOS build is 0.1.0 (2), which the owner reported successfully opening to the login screen on October 30.

The EAS preview environment currently has Android Google/Facebook values but no iOS Google client ID or Apple enable flag. Apple Developer needs an interactive sign-in. The inspected Google account showed no accessible project. Railway CLI authentication is expired. No provider keys, credentials, production flags, or store distributions were changed as part of those checks.

## Player behavior

- Existing player: sign in using the current method, open account controls, and link Apple/Google/Facebook. Linking requires a Nine Below session authenticated within five minutes.
- A provider identity already linked elsewhere cannot be attached to a second player. Matching email addresses never automatically merge players.
- New player: provider login still requires choosing a valid display name and supplying the Nine Below alpha invite when the invite gate is enabled.
- Apple can hide the personal email behind its private relay. Nine Below requests email, not a real name; the public display name is chosen separately.
- iOS uses Apple's native button and prompt; Android opens Apple in the system browser. Installing through Google Play does not restrict which identity provider a player may use.
- iOS Facebook uses Limited Login with public_profile, not an access token sent to Graph. Advertising tracking, advertiser-ID collection, and automatic app events stay off.
- Account deletion re-verifies the selected method, revokes every stored Apple client grant, then deletes the game account. If Apple revocation is unavailable, deletion returns a retryable error and does not silently skip revocation.

## Provider-console setup

Never paste private keys, client secrets, passwords, or MFA codes into chat or Git. Enter passwords/MFA directly on each provider's page. Existing App Store Connect upload keys and APNs keys are **not** Sign in with Apple keys.

### Apple Developer

Use the existing Potterwell team **63FQJRQ66P** and App ID **com.potterwell.ninebelow**.

1. Enable Sign in with Apple on the existing App ID as the **primary App ID**.
2. Register/reuse a Services ID for the Android web flow, suggested **com.potterwell.ninebelow.signin**. Associate it with that primary App ID. This grouping is essential for the same Apple identity across iOS and Android.
3. Configure domain **ninebelow.potterwell.com** and exact return URL **https://ninebelow.potterwell.com/auth/apple/callback**. Do not register the mobile custom scheme with Apple.
4. Create/reuse a Sign in with Apple signing key for that primary App ID. Keep the .p8 and key ID in protected server configuration only. Creating a persistent credential requires owner approval at the console action.
5. Register the transactional sender/domain with Apple's private-email-relay service if sending recovery emails to relay addresses. Confirm SPF/DKIM and test recovery delivery.
6. Refresh the iOS provisioning profile through EAS so it contains the Apple sign-in entitlement. Do not revoke existing distribution certificates.

Official references: [Apple cross-platform configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple), [Services ID setup](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web), [Expo SDK 54 Apple Authentication](https://docs.expo.dev/versions/v54.0.0/sdk/apple-authentication/).

### Google Cloud

Use the existing project that owns the Android and Web OAuth client IDs, not a new project.

1. Register/reuse an **iOS OAuth client** with bundle ID **com.potterwell.ninebelow**, team **63FQJRQ66P**, and App Store ID **6814632886** where requested.
2. Put its public client ID in EAS preview as **EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID**. Keep the existing **EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID** unchanged.
3. The Expo config derives the reversed iOS URL scheme from that ID.
4. Confirm server **GOOGLE_CLIENT_IDS** accepts the audience returned by the configured SDK (the existing Web client). Only add the iOS client ID if the verified token audience requires it; never accept arbitrary client IDs.
5. Confirm consent-screen publishing/test-user access and use the same project to preserve Google identities.

[Google Sign-In Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo).

### Meta

Use the existing Nine Below Facebook app. Add/verify its iOS platform with bundle **com.potterwell.ninebelow** and App Store ID **6814632886**. Confirm Facebook Login / Limited Login availability and app-mode/tester restrictions. Keep the same Facebook App ID across platforms so app-scoped identities remain consistent.

Do not enable advertising tracking to make sign-in work. [SDK Limited Login implementation](https://github.com/thebergamo/react-native-fbsdk-next#limited-login-ios-only).

## Runtime configuration

Server-only Railway variables:

| Variable | Value / purpose |
| --- | --- |
| APPLE_SIGN_IN_ENABLED | 1 only after iOS/signing setup and smoke checks |
| APPLE_SIGN_IN_ANDROID_ENABLED | 1 only after Services ID/domain setup |
| APPLE_SIGN_IN_IOS_CLIENT_ID | com.potterwell.ninebelow |
| APPLE_SIGN_IN_SERVICE_ID | Verified, grouped Services ID |
| APPLE_SIGN_IN_TEAM_ID | 63FQJRQ66P |
| APPLE_SIGN_IN_KEY_ID | Actual Sign in with Apple key ID |
| APPLE_SIGN_IN_PRIVATE_KEY | Protected PEM .p8 contents; real newlines or escaped newline sequences |
| APPLE_SIGN_IN_REDIRECT_URI | https://ninebelow.potterwell.com/auth/apple/callback |
| FACEBOOK_IOS_LOGIN_ENABLED | 1 after Meta iOS configuration |
| EARLY_ACCESS_PII_KEY / EARLY_ACCESS_TOKEN_SECRET | Existing strong encryption/signing configuration; do not rotate casually |

EAS preview client variables:

- EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=1 once both intended mobile paths are ready.
- EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<actual public iOS OAuth client ID>.
- Preserve existing Google Web ID and Facebook App ID/client token/display name.
- **Never put Apple's private key or Meta's app secret in an EXPO_PUBLIC variable.**

The API reports safe readiness booleans at /auth/config. The client combines those with build configuration and native Apple availability. iOS Google/Facebook are hidden unless equivalent Apple login is available. Android's existing Google/Facebook paths remain independent of Apple readiness.

## Storage and security properties

- An additive PostgreSQL JSONB collection, **golf9_provider_transactions**, stores short-lived challenge records alongside the existing single-writer, revision-fenced game state. JSON test/local storage supports the same records.
- Random 256-bit nonce/state/challenge IDs, ten-minute expiry, server-verified RS256 signatures, exact issuers/audiences, nonce checks, and a device-held SHA-256 verifier bind each new flow.
- Android's HTTPS callback exchanges the code server-side. Only an opaque challenge ID enters the custom-scheme redirect; provider tokens, game sessions, email, and the device verifier never appear there.
- Purpose and account binding separate login, linking, and deletion. Callback/code exchange is claimed before awaiting network work; one-use consumption is saved with the account mutation. An interrupted exchange requires a new login.
- Apple email and refresh grants, and temporary verified identities, are AES-256-GCM encrypted using the existing PII key. No raw authorization code, ID token, or refresh token is persisted. Google/Facebook's existing stored identity fields are unchanged by this rollout.
- Only verified Apple email can serve as recovery contact. Limited Login email claims are not accepted as recovery proof.
- Explicit no-store responses, bounded transaction counts, existing IP throttles, constrained form bodies, fixed redirect targets, and redacted errors apply.
- Expired/consumed transaction records are removed from snapshots on subsequent saves. Device-held verifiers live only in the in-progress login state.

## Verification and rollout

Completed locally on October 30:

- Full server suite: **240 passed**, including game/cross-platform integration checks. Provider-specific JWT/replay/revocation tests were also rerun after the final grant-storage guard.
- Client lint and TypeScript: passed.
- Social-auth/config tests: **9 passed**; native-codegen/autolinking tests: **5 passed**; browser-dialog tests: **5 passed**.
- Expo SDK dependency compatibility: passed.
- Production browser export and iOS/Android Hermes source exports: passed. The latter are compile checks under artifacts/social-auth-source-check, **not signed store packages**.
- Real Apple/Google/Meta account sign-in, live PostgreSQL migration, signed native compilation/IPA inspection, physical-device launch, and store distribution: still pending provider setup and access.

Dependency check on October 30: npm audit reports five pre-existing server dependency advisories (one moderate, three high, one critical) across body-parser, engine.io, nodemailer, proxy-addr, and qs. The newly added jose dependency is not listed. The client install also reported existing dependency advisories. These are not a new repository-wide security assessment or proof of exploitability; dependency remediation and re-testing remain a production-release gate. No broad framework or mail-library upgrade was bundled into this authentication change.

Before releasing:

1. Run the full server suite, client lint/typecheck, dependency check, native-codegen tests, social-auth tests, and browser export.
2. Inspect actual EAS-generated iOS autolinking/CocoaPods and Fabric registry. Google is now deliberately linked, so its native class **must be present**. Keep only expo-in-app-updates excluded on iOS. Do not restore the old “Google marker must be absent” release assertion.
3. Inspect the signed IPA for all generated Fabric classes, correct bundle/build/entitlement, deployment targets, and no private configuration/source maps.
4. Verify provider setup and deploy backend with gates off; confirm migration, /health/ready, and existing password/Android social login.
5. Enable configured gates, build iOS 3 and Android 60 with preview variables, then test on real devices: cold launch; each provider; cancellation; new-account invite; existing-account linking; same player/progress across platforms; Hide My Email; revoked/expired challenge; logout; account deletion and Apple revocation.
6. Submit the exact verified artifacts to TestFlight and Google Play closed testing. This requires new native binaries, not only a website deployment or JavaScript update.
7. Test a cross-platform room. Do not infer physical-device success from unit tests or an EAS build finishing.

## Disabling and recovery

- Set APPLE_SIGN_IN_ANDROID_ENABLED=0 to hide/stop new Android Apple flows only.
- Set FACEBOOK_IOS_LOGIN_ENABLED=0 to disable iOS Limited Login only; Android Facebook remains available.
- Set APPLE_SIGN_IN_ENABLED=0 to stop Apple login. Because iOS third-party options require the equivalent Apple option, this also hides iOS Google/Facebook.
- Existing Nine Below sessions are not revoked by these flags. Apple-only users who sign out will need the service restored; do not disable all their login paths without a recovery plan.
- Keep Apple signing/encryption settings while disabling flags so existing account deletion can still revoke grants.
- Never rotate/delete the PII key without a migration: doing so makes encrypted Apple grants and existing early-access data unreadable.
- A failed authorization exchange is retried by starting sign-in again. Do not replay a used Apple code.
- No automatic browser social-login rollout is included.

The Android Apple glyph is the unmodified Font Awesome Free 6.7.2 Apple brand icon, Copyright 2024 Fonticons, Inc., licensed [CC BY 4.0](https://fontawesome.com/license/free). iOS uses Apple's native authentication button.
