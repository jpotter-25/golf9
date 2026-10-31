# Mobile social login rollout — October 30, 2026

## Status and scope

### Latest: restart recovery and neutral buttons

The October 30 production login outage was shared storage readiness, not a Google, Apple, or Facebook credential failure. Railway deployment `b7e1a365-a398-44ed-9756-7097849b7a10` logs show a handoff completion at 19:05:21 CDT, a `STALE_STATE_WRITE` fence and restart at 19:05:22, then a process waiting for a deployment health probe from 19:05:24 until a manual health request around 20:05:59. A restarted process was not receiving another deployment probe.

Ordinary HTTP requests and Socket.IO reconnects now initiate the same delayed authoritative reload as the deployment probe. Recovery is single-flight even while the database read is pending, bounded to 30 seconds, and cannot reopen writes after shutdown or fatal fencing. Pending mutations return 503 with `Retry-After` and `PERSISTENCE_HANDOFF_PENDING` before their handlers run. PostgreSQL CAS revision fencing, TLS certificate validation, and authentication checks remain intact. A transient deployment conflict can still cause a safe restart; it no longer requires someone to manually visit `/health` to unstick the restarted process. Operate one Railway replica; this is not multi-writer support.

Native source `cbc1c87e7123ec98f73b9ddae5460da1d87c7bd5` builds iOS 7 / Android versionCode 63 with equal light provider buttons, 52-point baseline height, matching corner radius, consistent 12-point gaps, and reduced label weight. iOS retains Apple's native white authentication button. The Google mark is the unmodified asset downloaded from [Google's official branding page](https://developers.google.com/identity/branding-guidelines), asset URL `https://developers.google.com/static/identity/images/g-logo.png`. No tracking or provider scope changes.

Meta app `1315258740282659` was rechecked live: **Unpublished**, **Business verification required**, **Publish disabled**. `FACEBOOK_IOS_LOGIN_ENABLED` stays false until this is resolved and Limited Login is tested. Do not assign ordinary testers developer roles as a workaround. Android Facebook access for existing app-role accounts does not prove general tester access.

Verification: 273 server tests and 34 client tests pass, including eight actual handoff-adapter/ingress regressions, four persistence batching/coalescing regressions, and three provider-button tests. Client lint, typecheck, and production browser export pass. Visual checks cover actual Android/web button components at 320px and 375px; native iOS rendering and real-device OAuth still require device acceptance. Historical sections below record previous releases, not current distribution status.

Live deployment `ea9b384d-c87e-4bee-a94f-5d66bc4e1dcc` reproduced the deployment fence at 20:17:54 CDT, restarted, and recovered at 20:18:08 from ordinary `/auth/config` traffic without an operator `/health` request. Subsequent readiness checks returned 200. iOS and Android Apple challenges durably saved with 200 responses, but a timed follow-up exceeded 15 seconds, revealing an additional persistence latency issue. Snapshot writes performed a separate INSERT per record and background saves could accumulate stale queued snapshots. Follow-up source `213b801e030c358f902dc756d44ae70aaca92be7` batches ordinary/audit inserts (200 rows max), keeps timestamp-merged early-access semantics unchanged, and coalesces background saves while taking each snapshot only when its serialized write starts. Critical auth still waits for a committed write and propagates failure. Deployment `f1d7df32-3f5f-4a1c-985a-37059ae9c102` became active; after its deployment fence/restart, ordinary routed traffic recovered it again. `/health/ready` returned 200, and valid anonymous Apple challenges returned 200 after durable writes in **479 ms (iOS)** and **352 ms (Android)**. These are server preparation checks, not real player authentication or an SLA.

Latest package/distribution record:

- **iOS 0.1.0 (7)**: EAS `0709ac93-36b7-482d-a747-d0c36af5ff64`, submission `3adeb4e8-6e25-480b-b3e5-024a2f4db132`, Apple build `be627657-6b05-4311-ad2c-907480f4c574`. Apple reports VALID, APPROVED, IN_BETA_TESTING; App Store Connect visibly shows **Testing** in the existing Internal Testers and Private Playtesters groups. Automatic notification is enabled; receipt is not verified. Existing public link and tester roles are unchanged. Local `artifacts/nine-below-0.1.0-ios-build-7.ipa`: 21,255,634 bytes, SHA-256 `4148c2c4f3ad343f3835a5bd257f2c932f90af26767574c886dc3c69b335b51c`.
- **Android 0.1.0 (63)**: EAS `e3b03a3b-f7a9-49f7-a439-d3c9f144cb66`, finished. Local `artifacts/Nine-Below-Android-0.1.0-version-code-63.aab`: 51,788,183 bytes, SHA-256 `ccc97ff86438cbb901074eea6f3537ba70af545a634828cdb0bb86349c1c5168`. Google Play accepted the bundle as version 63, target SDK 36 / minimum 24, with unchanged device coverage. Release 15, “Nine Below closed test 63,” was submitted to the existing Closed testing – Alpha track `4700919917437591631` for the unchanged full tester audience. Publishing overview shows **Changes in review**, with quick checks still running and managed publishing off. It will become available after Google approval; availability is not yet verified. Version 62 was verified available to selected testers. No production release or audience expansion.
- Both packages pass ZIP integrity and feature-bundle checks. IPA checks preserve bundle/team, Apple entitlement, minimum iOS, URL schemes, framework/component markers. AAB checks preserve the embedded upload certificate and package ID. The Google asset has identical decoded RGBA pixels after Android's lossless PNG resource rewriting. These are static package checks, not full platform signature verification or physical-device tests.
- **Meta**: Potterwell portfolio `2571927613274775` was created with owner approval and linked to the existing app. The owner entered the business address directly in Meta, selected the matching public record **Ninebelow, A Registered Series Of Potterwell LLC**, and completed business-phone verification. Meta Security Center now shows **In review** for that legal entity, with an estimate of about two business days. Optional tax ID was not supplied. The business is not yet approved and the app is not published. No address, phone number, or confirmation code is recorded in this document. Facebook iOS remains off pending approval, publication, and Limited Login testing.

### Current tester handoff

1. Retry sign-in after the server recovery. Existing installations benefit from the backend fix without reinstalling.
2. On iPhone, update Nine Below in TestFlight to **0.1.0 (7)** using the existing invitation or [public link](https://testflight.apple.com/join/snuTfM67).
3. On Android, use the existing Google Play closed-test enrollment and install **versionCode 63** once approved/available. Do not upload the IPA or an APK to this release.
4. Check button spacing and provider success/cancellation, then logout/re-login and play a shared iPhone/Android room. Existing accounts should link additional providers from account controls, not create duplicate accounts.
5. Facebook iOS remains hidden until Meta verification/publication and Limited Login acceptance testing are complete. New accounts still need their separate Nine Below alpha signup code.

### Historical: initial social-login rollout (iOS 3 / Android 60)

Implemented in source: Google and Facebook on iOS, Sign in with Apple on iOS and Android, account linking, fresh-provider verification for deletion, and Apple token revocation. Browser login remains Nine Below display name/password. All platforms still use the same player database and authoritative game server.

**iOS 0.1.0 (3) is approved and available to the existing TestFlight group; Android versionCode 60 is packaged but not uploaded to Google Play.** Physical-device launch/sign-in acceptance remains pending. Build 2 was the previously distributed iOS version, which the owner reported successfully opening to the login screen on October 30. This is a beta rollout, not a public App Store or production release.

Provider-console setup is complete for Google iOS and Apple iOS/Android, using the owner's explicitly approved credential batch. The company account **app-developer@potterwell.com** manages OAuth in the existing **nine-below** Google project; project ownership, existing clients, billing, and Expo ownership are unchanged. Cloud Identity Free is active, the Business Plus trial is canceled, and SiteGround mail/MX records remain unchanged.

The live `/auth/config` reports Apple iOS/Android enabled, existing Google/Facebook enabled, and Facebook iOS disabled. Meta's app remains unpublished and requires business verification before general tester access. Physical-device OAuth testing and Google Play upload remain outstanding.

Live verification exposed a PostgreSQL-only bug: `persistProviderState` referenced an out-of-scope `staleWriter`. Commit **2e1d74e31244b98a5dae216424fbee8420f4006e** reads the actual PostgreSQL runtime status and preserves the write fence. Five regression tests exercise the real adapter; the full suite now passes 245 tests. Railway deployment **a792ce13-836c-45a8-85fe-85e5aac7e6fc** succeeded, both health endpoints returned 200, and real iOS/Android Apple challenge creation returned 200 after durable PostgreSQL saves. The Android authorization URL uses the expected Services ID and HTTPS callback. These checks do not authenticate a real player.

Build tracking:

- Android 60: EAS **4bf8019e-7530-446e-94ab-b06109c28d03**, source **676c63a8**, finished; server-only fix does not require rebuilding it. Local **artifacts/Nine-Below-Android-0.1.0-version-code-60.aab** is 51,759,833 bytes, SHA-256 **56f787406a8a7e45a5bd83c9f3a7e0c643913ea2656e4c2fa0fbebc2b53b7f00**. Verified RSA signature against the existing upload certificate, signed manifest and all 1,587 payload digests, package/version 0.1.0 (60), non-debuggable release, target SDK 36 / minimum 24, and no advertising-ID permissions. Google Play upload and physical-device testing remain pending.
- First iOS 3 attempt **6685b3ce-2f38-45f4-98cf-edb6c25a2a7a** failed at CocoaPods: AppCheckCore requires modular GoogleUtilities/RecaptchaInterop dependencies.
- Replacement iOS 3 **623ce501-c34b-46a3-96d0-fc2ebd880038**, source **56e6f308**, finished with narrowly scoped `extraPods` modular headers, following the [Google Sign-In setup guidance](https://react-native-google-signin.github.io/docs/setting-up/ios). No global framework switch or SDK downgrade.
- Signed IPA **artifacts/nine-below-0.1.0-ios-build-3.ipa**, SHA-256 **144f38a0204821de620b4f4f9a1b169bc8c6f4b57d5fe9d773339a806d43d929**. Static inspection verified build/bundle/team, Apple entitlement, Google URL scheme, all 50 generated Fabric classes, expected Facebook launch configuration with tracking/events disabled, device ARM64 frameworks and Hermes bundle. No recognized secret/source-map files or PEM private-key markers were found. OS Swift libraries resolve via the binary's `/usr/lib/swift` path on its iOS 15.1 minimum; these are not missing packaged frameworks.
- EAS submission **b3941e38-12ee-4606-801f-776ffc26bd00** finished successfully. Apple resource **e690c999-f790-4552-91f5-3253086c1424** is `VALID`, beta review `APPROVED`, external state `IN_BETA_TESTING`. Build 3 is assigned to the existing **Private Playtesters** group with What to Test saved and automatic notification enabled. Public link **https://testflight.apple.com/join/snuTfM67** is unchanged. Prior builds, group settings, tester accounts/roles, and reviewer credentials were preserved. Notification receipt and actual device behavior are not verified.

### Historical tester handoff (superseded by the current handoff above)

1. On iPhone, open TestFlight and update Nine Below to **0.1.0 (3)** using the existing invitation or public link.
2. Cold-launch the app. Apple and Google should appear; Facebook iOS is intentionally hidden until Meta approval.
3. Existing players: sign in with the current method, then link Apple/Google from account controls to retain progress. Do not create a new account just because the provider uses the same email.
4. New players still need a separate Nine Below alpha signup code. The TestFlight link is not that code.
5. Test provider success/cancellation, Hide My Email, logout/re-login, and a shared game across iPhone and Android. Report build/device/OS and reproduction steps without credentials.
6. Upload the verified **version 60 AAB**, not the IPA or an APK, as the next Google Play closed-testing release. Keep the existing tester audience.

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
- Signed iOS compilation/static IPA inspection, Android integrity/signer checks, Apple processing/approval, and assignment to the existing external group passed. Real Apple/Google/Meta account sign-in, physical-device launch, Hide My Email delivery, Google Play upload, and notification receipt remain unverified.

Run EAS builds through `eas env:exec preview` so local iOS configuration validation sees the same public provider values as the cloud worker. Example: `eas env:exec preview 'eas build --platform ios --profile testflight --non-interactive --no-wait' --non-interactive`. This avoids writing public-provider environment files locally. Signed native package checks remain necessary; local source tests do not execute CocoaPods.

Historical operational observation: `/health/ready` could stay 503 until someone requested `/health`. The restart recovery fix described at the top supersedes that behavior: ordinary HTTP/Socket.IO ingress can now trigger the same delayed reload. Railway's configured deployment healthcheck remains `/health`; verify `/health/ready` and a durable write after deployment. Do not remove revision fencing or force a second writer to make readiness green.

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
