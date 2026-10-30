# Mobile social login rollout — October 30, 2026

## Status and scope

Implemented in source: Google and Facebook on iOS, Sign in with Apple on iOS and Android, account linking, fresh-provider verification for deletion, and Apple token revocation. Browser login remains Nine Below display name/password. All platforms still use the same player database and authoritative game server.

**This is not a released mobile build.** Source reserves iOS build **3** and Android versionCode **60**; do not tell testers these are available until EAS/Apple/Google processing and physical-device verification complete. The previously distributed iOS build is 0.1.0 (2), which the owner reported successfully opening to the login screen on October 30.

Provider-console setup is complete for Google iOS and Apple iOS/Android, using the owner's explicitly approved credential batch. The company account **app-developer@potterwell.com** manages OAuth in the existing **nine-below** Google project; project ownership, existing clients, billing, and Expo ownership are unchanged. Cloud Identity Free is active, the Business Plus trial is canceled, and SiteGround mail/MX records remain unchanged.

The live `/auth/config` reports Apple iOS/Android enabled, existing Google/Facebook enabled, and Facebook iOS disabled. Meta's app remains unpublished and requires business verification before general tester access. Physical-device OAuth testing and distribution of the new binaries remain outstanding.

Live verification exposed a PostgreSQL-only bug: `persistProviderState` referenced an out-of-scope `staleWriter`. Commit **2e1d74e31244b98a5dae216424fbee8420f4006e** reads the actual PostgreSQL runtime status and preserves the write fence. Five regression tests exercise the real adapter; the full suite now passes 245 tests. Railway deployment **a792ce13-836c-45a8-85fe-85e5aac7e6fc** succeeded, both health endpoints returned 200, and real iOS/Android Apple challenge creation returned 200 after durable PostgreSQL saves. The Android authorization URL uses the expected Services ID and HTTPS callback. These checks do not authenticate a real player.

Build tracking:

- Android 60: EAS **4bf8019e-7530-446e-94ab-b06109c28d03**, source **676c63a8**, finished; server-only fix does not require rebuilding it. Local **artifacts/Nine-Below-Android-0.1.0-version-code-60.aab** is 51,759,833 bytes, SHA-256 **56f787406a8a7e45a5bd83c9f3a7e0c643913ea2656e4c2fa0fbebc2b53b7f00**. Verified RSA signature against the existing upload certificate, signed manifest and all 1,587 payload digests, package/version 0.1.0 (60), non-debuggable release, target SDK 36 / minimum 24, and no advertising-ID permissions. Google Play upload and physical-device testing remain pending.
- First iOS 3 attempt **6685b3ce-2f38-45f4-98cf-edb6c25a2a7a** failed at CocoaPods: AppCheckCore requires modular GoogleUtilities/RecaptchaInterop dependencies.
- Replacement iOS 3 **623ce501-c34b-46a3-96d0-fc2ebd880038**, source **56e6f308**, finished with narrowly scoped `extraPods` modular headers, following the [Google Sign-In setup guidance](https://react-native-google-signin.github.io/docs/setting-up/ios). No global framework switch or SDK downgrade.
- Signed IPA **artifacts/nine-below-0.1.0-ios-build-3.ipa**, SHA-256 **144f38a0204821de620b4f4f9a1b169bc8c6f4b57d5fe9d773339a806d43d929**. Static inspection verified build/bundle/team, Apple entitlement, Google URL scheme, all 50 generated Fabric classes, expected Facebook launch configuration with tracking/events disabled, device ARM64 frameworks and Hermes bundle. No recognized secret/source-map files or PEM private-key markers were found. OS Swift libraries resolve via the binary's `/usr/lib/swift` path on its iOS 15.1 minimum; these are not missing packaged frameworks.
- EAS submission **b3941e38-12ee-4606-801f-776ffc26bd00** finished successfully. Apple processing / beta distribution is still pending; this is not a public App Store release.

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

Verified configuration: primary App ID enabled; grouped Services ID **com.potterwell.ninebelow.signin**; Sign in with Apple-only key **S6N35XY9S2** sealed in Railway; existing APNs key/certificate unchanged. Native and Services ID credential probes both returned `invalid_grant` for intentionally invalid codes, rather than `invalid_client`; this is not a real player login. The transactional relay sender **donotreply@potterwell.com** is registered; actual Hide My Email recovery delivery still needs testing. EAS refreshed provisioning profile **BLMMAR54W8** using the existing distribution certificate.

The temporary plaintext .p8 was removed after an encrypted Windows CurrentUser DPAPI backup was decrypted and compared successfully in memory. The protected local backup is outside Git; the operational key is sealed in Railway. The DPAPI backup depends on the owner's Windows account and is not a portable disaster-recovery copy. Never expose either copy in an app bundle or public build variable.

1. Enable Sign in with Apple on the existing App ID as the **primary App ID**.
2. Register/reuse a Services ID for the Android web flow, suggested **com.potterwell.ninebelow.signin**. Associate it with that primary App ID. This grouping is essential for the same Apple identity across iOS and Android.
3. Configure domain **ninebelow.potterwell.com** and exact return URL **https://ninebelow.potterwell.com/auth/apple/callback**. Do not register the mobile custom scheme with Apple.
4. Create/reuse a Sign in with Apple signing key for that primary App ID. Keep the .p8 and key ID in protected server configuration only. Creating a persistent credential requires owner approval at the console action.
5. Register the transactional sender/domain with Apple's private-email-relay service if sending recovery emails to relay addresses. Confirm SPF/DKIM and test recovery delivery.
6. Refresh the iOS provisioning profile through EAS so it contains the Apple sign-in entitlement. Do not revoke existing distribution certificates.

Official references: [Apple cross-platform configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple), [Services ID setup](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web), [Expo SDK 54 Apple Authentication](https://docs.expo.dev/versions/v54.0.0/sdk/apple-authentication/).

### Google Cloud

Use the existing project that owns the Android and Web OAuth client IDs, not a new project.

Created **Nine Below iOS**, client **480561997054-e49k6kj3fm311i41gon3lgbcmgbb2fdl.apps.googleusercontent.com**, with the existing bundle/team and App Store ID **6814632886**. Its public ID is saved in EAS preview. Consent audience is External / In production. Existing Web and Android clients are unchanged. The company account has scoped OAuth Config Editor, View Service Accounts, and Service Usage Viewer roles; it was not made project owner.

1. Register/reuse an **iOS OAuth client** with bundle ID **com.potterwell.ninebelow**, team **63FQJRQ66P**, and App Store ID **6814632886** where requested.
2. Put its public client ID in EAS preview as **EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID**. Keep the existing **EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID** unchanged.
3. The Expo config derives the reversed iOS URL scheme from that ID.
4. Confirm server **GOOGLE_CLIENT_IDS** accepts the audience returned by the configured SDK (the existing Web client). Only add the iOS client ID if the verified token audience requires it; never accept arbitrary client IDs.
5. Confirm consent-screen publishing/test-user access and use the same project to preserve Google identities.

[Google Sign-In Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo).

### Meta

Use the existing Nine Below Facebook app. Add/verify its iOS platform with bundle **com.potterwell.ninebelow** and App Store ID **6814632886**. Confirm Facebook Login / Limited Login availability and app-mode/tester restrictions. Keep the same Facebook App ID across platforms so app-scoped identities remain consistent.

Current console: app **1315258740282659**, unpublished/development mode, business verification required and Publish disabled. The iOS bundle is saved and automatic iOS app events are off. App Store ID fields remain blank because the initial form with those IDs did not persist; do not claim the store listing is registered. `FACEBOOK_IOS_LOGIN_ENABLED` remains unset/false. Do not grant playtesters developer-console roles to bypass publication requirements.

Do not enable advertising tracking to make sign-in work. [SDK Limited Login implementation](https://github.com/thebergamo/react-native-fbsdk-next#limited-login-ios-only).

## Runtime configuration

Server-only Railway variables:

| Variable | Value / purpose |
| --- | --- |
| APPLE_SIGN_IN_ENABLED | Currently 1 |
| APPLE_SIGN_IN_ANDROID_ENABLED | Currently 1 |
| APPLE_SIGN_IN_IOS_CLIENT_ID | com.potterwell.ninebelow |
| APPLE_SIGN_IN_SERVICE_ID | com.potterwell.ninebelow.signin |
| APPLE_SIGN_IN_TEAM_ID | 63FQJRQ66P |
| APPLE_SIGN_IN_KEY_ID | S6N35XY9S2 |
| APPLE_SIGN_IN_PRIVATE_KEY | Sealed Railway PEM; never exposed to clients or committed |
| APPLE_SIGN_IN_REDIRECT_URI | https://ninebelow.potterwell.com/auth/apple/callback |
| FACEBOOK_IOS_LOGIN_ENABLED | Currently unset/false; publication/business verification outstanding |
| EARLY_ACCESS_PII_KEY / EARLY_ACCESS_TOKEN_SECRET | Existing strong encryption/signing configuration; do not rotate casually |

EAS preview client variables:

- EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=1 is configured.
- EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=480561997054-e49k6kj3fm311i41gon3lgbcmgbb2fdl.apps.googleusercontent.com is configured.
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

- Full server suite: **245 passed**, including game/cross-platform integration checks and five PostgreSQL adapter regression cases. Focused provider/PostgreSQL suite: **28 passed**.
- Client lint and TypeScript: passed.
- Social-auth/config tests: **9 passed**; native-codegen/autolinking tests: **5 passed**; browser-dialog tests: **5 passed**.
- Expo SDK dependency compatibility: passed.
- Production browser export and iOS/Android Hermes source exports: passed. The latter are compile checks under artifacts/social-auth-source-check, **not signed store packages**.
- Signed iOS compilation and static IPA inspection passed. Real Apple/Google/Meta account sign-in, physical-device launch, Hide My Email delivery, and new tester distribution remain unverified.

Run EAS builds through `eas env:exec preview` so local iOS configuration validation sees the same public provider values as the cloud worker. Example: `eas env:exec preview 'eas build --platform ios --profile testflight --non-interactive --no-wait' --non-interactive`. This avoids writing public-provider environment files locally. Signed native package checks remain necessary; local source tests do not execute CocoaPods.

Operational observation: after deployment, `/health/ready` has sometimes stayed 503 with writer handoff pending until `/health` is requested and the existing five-second handoff completes. Railway's configured healthcheck is `/health`. Verify both endpoints after deployments. Do not remove revision fencing or force a second writer to make readiness green.

Dependency check repeated October 30: npm audit reports five server dependency advisories (one moderate, three high, one critical) across body-parser, engine.io, nodemailer, proxy-addr, and qs. The newly added jose dependency is not listed. Client audit reports 33 advisories (nine low, eight moderate, fifteen high, one critical). These are not a new repository-wide security assessment or proof of exploitability; dependency remediation and re-testing remain a public-production-release gate. No broad framework or mail-library upgrade was bundled into this authentication change.

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
