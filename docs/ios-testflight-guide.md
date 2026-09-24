# Nine Below: iOS and TestFlight setup guide

Prepared September 21, 2026; release status updated September 24, 2026. Product: **Nine Below by Potterwell**.

This guide explains the registered iOS app and TestFlight workflow. **Build 0.1.0 (1) reached external testing but has a confirmed native launch crash. The replacement is 0.1.0 (2).** Its source fix, signed IPA checks, current Apple upload/distribution status, and tester acceptance steps are recorded in the [build 2 release record](ios-testflight-build-2.md). Successful compilation does not establish a successful physical-device launch. The Apple app, signing, and upload credentials are already configured; do not create duplicates. This is not a public App Store release.

**Audience checkpoint:** September 24 live checks found **Public Link enabled** on the existing **Private Playtesters** group, differing from the September 21 email-only setup. There is one tester and only build 1 assigned. Preserve the setting until the owner decides whether to disable the link or retain link-based access before build 2 is distributed. A group's name does not enforce private access.

### Verified Apple registration — September 21, 2026

- App: **Nine Below**; [App Store Connect record](https://appstoreconnect.apple.com/apps/6814632886/distribution/info).
- Public developer name approved at creation: **Ninebelow, A Registered Series Of Potterwell LLC**.
- Team ID: `63FQJRQ66P`; bundle ID: `com.potterwell.ninebelow`; Push Notifications capability enabled.
- Numeric Apple ID: `6814632886`; SKU: `ninebelow-ios`.
- App record created with **Full Access** because Apple disabled Limited Access in this first-app form. No additional staff or testers were invited. Review app permissions before adding team members.
- `client/eas.json` now targets this app and team for TestFlight submission. Apple signing/upload credentials are not stored in the repository.
- Apple's default public-release draft is **1.0 / Prepare for Submission**. This is separate from the planned **0.1.0 (1)** TestFlight build; no public-release review was requested.

### Signing setup and first build — September 21, 2026

- The official EAS CLI reused the owner's authenticated local Apple session; no password or verification code was copied into project files.
- A new Apple Distribution certificate and App Store provisioning profile were created for the confirmed team. Existing certificates were not revoked. The current certificate/profile expire September 21, 2027; renew through EAS before expiry.
- An Apple Push Notifications service key was created and assigned to this app in EAS. Physical-device push delivery still needs verification.
- An App Store Connect API key with **APP_MANAGER** permissions was created and assigned to EAS Submit. The private key remains managed by EAS, not in the repository. Revisit credential permissions and rotation when team membership changes.
- First native build: [4f98cb7c-246f-44a9-8668-db5197cc16fa](https://expo.dev/accounts/nemoclown/projects/golf9/builds/4f98cb7c-246f-44a9-8668-db5197cc16fa), source commit `b819ef46193df3389359888c5e2461f007caa7e3`, profile `testflight`, version **0.1.0 (1)**.
- Build status: **finished**, September 21, 2026 at 20:34 UTC. The IPA declares bundle `com.potterwell.ninebelow`, version `0.1.0`, build `1`, minimum iOS `15.1`, iPhone/iPad device families, and iOS 26.0 SDK. Expected embedded provisioning/signature resources and JavaScript bundle are present; no `.p8`, `.p12`, `.env`, `credentials.json`, or source-map files were found in the archive. These checks do not replace Apple's signature validation or a device launch test.
- Local IPA: `artifacts/ios/build-1-4f98cb7c/nine-below-0.1.0-build-1.ipa` (15,081,570 bytes; ignored by Git). SHA-256: `c4cdf76a8dfdb4f1dedd180d0a4b4d195a7f8b31aa400ae981693171dc8328bb`. The local archive preserves the binary independently of hosted artifact retention.
- Upload job: [81212592-c48a-430e-897c-674ae22f733b](https://expo.dev/accounts/nemoclown/projects/golf9/submissions/81212592-c48a-430e-897c-674ae22f733b), targeting Apple app `6814632886` and the exact build above. Status: **finished**, September 21, 2026 at 20:38 UTC. Automatic TestFlight-group setup was explicitly disabled; no tester invitations or public release were performed.
- Historical September 21 processing: build `0.1.0 (1)` was **VALID / READY_FOR_BETA_TESTING**, then **Waiting for Review** after external review submission. September 24 live status is **IN_BETA_TESTING**; the tester's crash report confirms the launch defect documented in the [build 2 replacement record](ios-testflight-build-2.md). [TestFlight dashboard](https://appstoreconnect.apple.com/apps/6814632886/testflight/ios).
- Shared backend readiness and browser access passed read-only checks; iOS playtest build 1 returned `status: current`, `minimumBuild: 0`, and `storeReady: false`. Leave release announcements disabled until actual TestFlight installation is verified.

## What is already shared across platforms

Nine Below uses the same game account, server, rooms, game rules, and durable account data across Android, iOS, and the browser. Apple and Google distribute their respective app packages; the Nine Below server synchronizes play. A second database or copies of each player's account are not required merely to add iOS.

The iOS `testflight` build profile connects to `https://ninebelow.potterwell.com`, using the same `playtest` channel and backend as the Google Play testing build. It inherits the `playtest` environment, despite the environment label being `staging`. This is a shared service, so a tester's real account changes affect that account wherever it is used.

The browser build is configured to deploy at [ninebelow.potterwell.com/play/](https://ninebelow.potterwell.com/play/), with independent browser build number `1`. The Railway build now exports and serves the browser game. Verify that address after each deployment before inviting a wave; the existing homepage alone does not establish browser-game availability.

Use the same **Nine Below display name and password** to access the same account on another device. Use separate player accounts when testing a match between multiple devices. A TestFlight invitation, a Google Play tester invitation, and a Nine Below account invite code each serve different purposes.

The initial iOS and browser releases support Nine Below's own display-name/password login. Google and Facebook integrations remain Android-only. **Sign in with Apple is not implemented in this release.** See the existing-account section below if someone originally created an account only through Google or Facebook.

## 1. Finish the Apple account prerequisites

1. Sign in to [Apple Developer](https://developer.apple.com/account/) using the account enrolled in the paid Apple Developer Program.
2. Confirm the correct team is selected and enrollment is active.
3. If Apple shows an updated agreement, the Account Holder must review and accept it before Apple will allow app creation or signing.
4. Keep a trusted Apple device or phone available for two-factor authentication.
5. Find the **Team ID** under Apple Developer membership details. This is the development team's identifier; it is not your email address, bundle ID, or App Store Connect app number.

Do not paste your Apple password, verification codes, signing certificates, or private API keys into chat, GitHub, or this guide. Enter credentials directly into the interactive Apple/EAS prompt when setup reaches that point.

## 2. Register the app's identifier if it is missing

**Completed for this app.** `com.potterwell.ninebelow` is registered under team `63FQJRQ66P` with Push Notifications enabled. The steps below are reference only; do not create a duplicate identifier.

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Choose **Identifiers**, then **+**.
3. Choose **App IDs**, then the **App** type, and continue.
4. Description: `Nine Below`.
5. Select an **Explicit** bundle ID and enter `com.potterwell.ninebelow` exactly.
6. Enable capabilities that this build uses. Push Notifications is needed if iOS push notifications will be configured. EAS can synchronize the project's required capabilities during signing setup. Do not enable Sign in with Apple solely because this is an iOS app; this build does not implement it.
7. Continue, inspect the identifier, then **Register**.
8. Return to App Store Connect and refresh the New App dialog.

The bundle ID must match `ios.bundleIdentifier` in `client/app.config.js`. Apple binds uploaded builds to that identity. [Apple's identifier guide](https://developer.apple.com/help/account/identifiers/register-an-app-id/)

## 3. Fill in the New App screen

**Completed for this app.** Open the [existing record](https://appstoreconnect.apple.com/apps/6814632886/distribution/info), not New App. The creation values and reference procedure are retained below:

| Field | Enter or select |
| --- | --- |
| Platforms | **iOS** |
| Company Name / public developer name | **Ninebelow, A Registered Series Of Potterwell LLC** |
| Name | **Nine Below** |
| Primary language | **English (U.S.)** |
| Bundle ID | **com.potterwell.ninebelow** |
| SKU | **ninebelow-ios** |
| User Access | **Full Access** at creation; Apple disabled Limited Access. Prefer restricted app access for future staff where supported. |

If Apple reports that the name is unavailable, stop at that field and choose an approved alternative with Potterwell; do not change the bundle identifier to solve a name conflict. The SKU is your private inventory identifier and cannot be changed after app creation. Limited Access controls developer-console access, not who can play the game.

The record was created and its numeric **Apple ID**, `6814632886`, verified on **App Information**. The owner approved the exact public developer name above. Apple states that this first-app developer name cannot be edited later; an alternate name must be a registered trade/DBA name. [Apple developer-name rules](https://developer.apple.com/help/app-store-connect/create-an-app-record/set-your-developer-name).

| Identifier | Meaning | Example/value |
| --- | --- | --- |
| Apple account | Your Apple login | Your account email; enter it privately when requested |
| Team ID | Your enrolled developer team | `63FQJRQ66P` |
| Bundle ID | The app's technical identity | `com.potterwell.ninebelow` |
| App Store Connect Apple ID | Numeric identifier assigned to the app | `6814632886`; configured as `ascAppId` |
| SKU | Your private app inventory label | `ninebelow-ios` |
| EAS project ID | Existing Expo project | `b8c31c6b-71b9-497d-984c-d59a4871e84b` |

[Apple's New App instructions](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app) and [field definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information).

## 4. Build the signed iOS package from Windows

The upload package is an **IPA (`.ipa`)**. EAS Build compiles and signs it on a hosted Mac, and EAS Submit uploads it to Apple from this Windows computer. The New App webpage is for the app record; it is not a place to drag an AAB or IPA into a browser upload box.

The configured profile is `testflight`, with `distribution: "store"`, `simulator: false`, and the image `macos-sequoia-15.6-xcode-26.0`. Apple has required Xcode 26 and the iOS 26 SDK or newer for uploads since April 28, 2026. The build SDK is different from the oldest iOS version on which the app can run.

EAS's `distribution: "internal"` creates an ad hoc build for registered devices. It is not Apple's TestFlight internal-testing workflow. Use `testflight` for this release, not `staging` or `ios-simulator`.

For a guided shortcut, run the checked-in helper from the repository root:

```powershell
& .\scripts\build-ios-testflight.ps1
```

The helper starts the interactive EAS build; it does not itself upload to Apple or invite testers. If your PowerShell execution policy blocks the script, keep that policy in place and use the direct commands below. [Build helper](../scripts/build-ios-testflight.ps1)

Run these commands in PowerShell from the repository's `client` folder:

```powershell
Set-Location 'C:\Users\johnp\Documents\Codex\2026-06-04\prior-conversation-with-codex-conversation-role-3\work\golf9\client'
npx.cmd --yes eas-cli@latest whoami
```

If Expo asks for login, authenticate to the existing project owner/team. Then start the build interactively:

```powershell
npx.cmd --yes eas-cli@latest build --platform ios --profile testflight
```

During first-time signing setup:

1. Sign in to the Apple account directly in the terminal prompt.
2. Enter Apple's verification code directly in that prompt when requested.
3. Select **Ninebelow, A Registered Series Of Potterwell LLC**, team **63FQJRQ66P**.
4. Confirm the bundle identifier is `com.potterwell.ninebelow`.
5. Let EAS use or generate the Apple distribution certificate and App Store provisioning profile for this app. Do not revoke an existing certificate as a troubleshooting shortcut.
6. If push credentials are requested, configure the appropriate APNs key for the same team. A successful app build alone does not prove push delivery is configured.
7. Retain the EAS build ID and build page. Wait for **Finished**, inspect any warnings, and download the IPA if a local archive is wanted.

Apple credentials may require this interactive step even if Expo is already signed in. A noninteractive build cannot create missing signing credentials by itself. A failed or queued build is not an upload-ready package.

[Expo signing setup](https://docs.expo.dev/app-signing/managed-credentials/), [Expo build images](https://docs.expo.dev/build-reference/infrastructure/), [Apple SDK requirement](https://developer.apple.com/news/upcoming-requirements/).

## 5. Upload the exact finished build

The existing submission profile in `client/eas.json` is already configured for the verified Apple app and team. Preserve the other build and submission profiles. Its relevant fragment is:

```json
{
  "submit": {
    "testflight": {
      "ios": {
        "ascAppId": "6814632886",
        "appleTeamId": "63FQJRQ66P"
      }
    }
  }
}
```

This is a configuration illustration, not a file to paste over all of `eas.json`. These identifiers are not signing secrets and do not replace the upload credential.

Configure the upload credential interactively:

```powershell
npx.cmd --yes eas-cli@latest credentials --platform ios
```

Select the `testflight` profile and use **App Store Connect: Manage your API Key** → **Set up your project to use an API Key for EAS Submit** when those menu choices appear. EAS can guide an authorized Apple account through setup. An alternative is a privately configured app-specific password; neither secret belongs in source control.

Submit the build ID whose version, build number, and source you checked:

```powershell
npx.cmd --yes eas-cli@latest submit --platform ios --profile testflight --id REPLACE_WITH_FINISHED_EAS_BUILD_ID
```

In App Store Connect → Nine Below → **TestFlight**, wait for Apple to process **0.1.0 (1)**. Processing time varies. Resolve any **Missing Compliance**, invalid-binary, or signing messages before inviting testers. A successful EAS upload does not by itself mean Apple's processing succeeded.

This uploads for TestFlight. It does **not** publish the app publicly in the App Store. Public release is a separate submission and review. [Expo iOS submission guide](https://docs.expo.dev/submit/ios/)

## 6. Choose the right kind of private testing

Apple's word **internal** means an App Store Connect team member, not simply someone you personally selected.

| Testers | Recommended group | Developer-console access | Review |
| --- | --- | --- | --- |
| You and trusted Potterwell staff | Internal, up to 100 testers | Must have an eligible App Store Connect role and access to Nine Below | Available after processing and compliance steps |
| Selected friends, partners, or players | Private external group, up to 10,000 testers per app | None required | First external beta requires TestFlight App Review |

For personal contacts, use external testing with email invitations and keep the public invitation link disabled. This remains a private beta. Do not make personal contacts App Store Connect administrators just so they can test.

### Internal group for trusted staff

1. In App Store Connect → **Users and Access**, add only staff who need console access. Give the minimum suitable role and limit app access to Nine Below where possible. Eligible tester roles include Account Holder, Admin, App Manager, Developer, and Marketing.
2. Have each staff member accept the team invitation.
3. Open Nine Below → **TestFlight** → **Internal Testing** → **+**.
4. Name the group `Potterwell Internal QA`. Leave automatic distribution off for the first controlled rollout.
5. Use **Add Builds** to select the processed build and paste the What to Test text from the copy file linked below.
6. Choose **Invite Testers** and select the eligible staff accounts.
7. Each tester installs Apple's [TestFlight app](https://apps.apple.com/app/testflight/id899247664), opens their invitation on the device, accepts it, and installs Nine Below.

[Apple internal-testing instructions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers).

### Private external group for selected people

The existing external group is **Private Playtesters**, ID `0716e498-8de2-45cb-9510-ad247deaf9f7`. September 24 checks show one tester and build **0.1.0 (1)** assigned; that build is **IN_BETA_TESTING**, with automatic notification enabled, but has a confirmed launch crash. **Public Link is now enabled**, although it was not enabled during September 21 setup. The owner must resolve the audience choice before build 2 is assigned; see the [current release record](ios-testflight-build-2.md). Keep recipient names and email addresses out of Git, and verify installation outcomes independently of group membership.

1. Create the internal group first if one does not exist; Apple's external-group workflow requires one. Creating the group does not require inviting new staff.
2. Under **External Testing**, use **Private Playtesters** for the first selected wave. Create a separate wave-specific group only when that separation is intended.
3. Add the processed build.
4. Enter the beta description, monitored feedback email, contact information, and What to Test details. Starter copy is in [TestFlight copy](../store-assets/apple/testflight-copy.md).
5. Supply a working, non-administrator game review account if Apple needs login. Give Apple enough access to evaluate the game without depending on an expiring or already-used signup code. Keep its password in Apple's review form, not in repository files.
6. Submit for **TestFlight App Review** and wait for approval.
7. Add only the owner-selected testers by email. Do not add them through **Users and Access** or grant a developer-console role. Keep **Public Link** disabled unless you deliberately choose a later public-link wave.
8. After approval and build assignment, verify the installation invitation is sent. Automatic notification is enabled for this submitted build; if it is disabled for a later build, manually start testing/distribute that approved build. Provide a separate Nine Below signup code privately for a tester who needs a new game account. Test the full invitation and installation flow with one selected person before adding the rest.

[Apple external-testing instructions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers). Store screenshots and a public launch submission are separate from this initial beta workflow.

### Reviewer account and private recovery

A dedicated ordinary Nine Below review account is provisioned. Live checks verified password sign-in and account retrieval, and confirmed that admin API access was rejected with HTTP 401. The account is not an App Store Connect staff account and must not receive Nine Below administrative permissions. Physical-device sign-in through the uploaded build is still unverified.

The reviewer username/password and review contact details are saved in Apple's private beta review information. A recovery copy of the account credentials is held outside the repository at `%LOCALAPPDATA%\Potterwell\NineBelow\apple-review-account.dpapi`, encrypted with Windows DPAPI for the current Windows user. Its format/entropy label is `Potterwell.NineBelow.AppleReview.v1`; the label is not a password or decryption key. Recovery requires the originating Windows user's protected environment. Do not copy plaintext credentials into this guide, chat logs, commits, or tester invitations.

If recovery is unavailable, an authorized owner can reset only this dedicated game account through the admin console, verify sign-in and non-admin access again, and update Apple's review credentials before the next review. Keep the account usable while review is in progress; do not rotate/delete it mid-review without coordinating the changed credentials with Apple. The saved TestFlight feedback destination is `app-developer@potterwell.com`; keep it monitored. The unmonitored `donotreply@potterwell.com` sending identity is not the feedback destination.

## 7. Give testers access inside Nine Below

Apple's invitation grants the ability to install the beta. It does not create a Nine Below account or bypass the game's invite gate.

For a new player, create a limited-use signup code in the [Nine Below admin console](https://ninebelow.potterwell.com/admin/) → **Invites**, or use a ready and configured Early Access access campaign. Keep the existing invite gate enabled during controlled testing. The tester selects **Create Account**, chooses a display name and strong password, and enters their Nine Below invite code when required. A one-use code cannot be reused for another account.

Existing accounts with a Nine Below password can log in using the same display name/password on Android, iOS, and web. They do not need another signup code and should not create duplicate accounts to change devices.

### Existing Google/Facebook-only players

This first iOS/browser build does not offer those login buttons. A social-only player needs help adding password sign-in to the **existing** Nine Below account before using it on iOS or the browser.

The verified staff path is **Admin → Players → select the correct player → Reset Password**. After independently verifying the requester owns the account, an authorized staff member can leave the password field blank to generate a strong value and record an audit reason. This resets password credentials and revokes existing game sessions. Deliver the new password privately to the verified owner.

The interface calls this a temporary password, but the current player app does not provide a verified self-service password-change screen or enforce replacement at next login. Treat the generated password as a real credential; do not promise an automatic password-change prompt. This is a staff-assisted beta limitation, not account migration or a new Apple login feature.

### Early Access emails

Follow the [Early Access Operations Guide](early-access-operations.md) for enrollment, consent, selection, onboarding, delivery gates, and audit records. An email-only TestFlight rollout requires Apple's public link to be disabled; a link-based wave requires the owner's deliberate approval. Reconcile the live setting before sending a wave, rather than assuming it from this guide or the group name. Apple sends its own installation invitations; Nine Below sends or provides the separate game-access details.

Do not invent a public TestFlight link to satisfy a campaign form. Use manual game invite-code delivery for a small staff test, or verify an appropriate HTTPS installation/instruction destination before scheduling a private-wave campaign. Required email settings, including the sender/postal-address gates, still apply; this guide does not enable campaign delivery.

## 8. Publish the in-game release notice only after availability

The admin console already manages Android, iOS, and browser release policies separately. iOS build numbers are independent of Android's version code. Do not copy Android's current minimum build into iOS.

1. First verify an invited tester can install the uploaded iOS build and start the app.
2. In **Admin → Live Ops → App Releases**, choose **Testing (Play / TestFlight / web)** and **iOS**.
3. For the replacement rollout, enter **Latest build: 2**, **App version: 0.1.0**, and initially retain **Minimum allowed build: 0**. These are instructions, not an indication that this policy has been published.
4. Enter the verified HTTPS destination that helps this group obtain the update. Private invited testers can open the installed TestFlight app; do not enable a public invitation link just to populate this field. If no suitable destination has been verified, leave the existing iOS policy unchanged until one is ready.
5. Check **Release ready** only after the intended testers can access it. Prefer **Finish active match, then require update**.
6. Review the preview, enter an administrative reason, and **Publish Now** or deliberately schedule the policy.
7. Raise the minimum allowed build only after every intended tester can obtain the required version. Never raise it ahead of Apple processing, beta approval, or group availability.
8. Repeat separately for Android when its Google Play build is available, and for web only after the tested browser deployment is available. A marketing homepage is not proof that a browser game has been deployed.

For a rollout issue, use the release history and the relevant platform's policy to remove the requirement or restore the last suitable policy. A policy rollback does not downgrade an installed iOS app. If the binary itself is broken, ship a corrected higher build number and manage TestFlight distribution accordingly.

## 9. Mixed-platform acceptance checklist

Record the exact iOS build, Android version code, browser build, server revision, device models, OS/browser versions, and account names for each test. Use test accounts where actions could remove data.

- [ ] Install iOS through TestFlight and Android through the intended Google Play track; launch both from a fully closed state.
- [ ] Verify iPhone portrait layout, keyboard handling, notches/safe areas, and iPad layout if supporting tablets.
- [ ] Create an invited first-party account, log out, and use the same credentials on another platform; confirm the same profile and progress.
- [ ] Have distinct iOS and Android accounts join one room; add a browser account when a browser deployment is actually available.
- [ ] Complete a full game with alternating turns across devices. Confirm legal actions, hidden-card privacy, final scores, and match results agree.
- [ ] Test host departure, rejoin, background/foreground transitions, Wi-Fi/mobile-data switching, and brief network loss.
- [ ] Confirm reconnecting does not duplicate a turn, reward, match, or account.
- [ ] Confirm release notices target the selected platform and channel; Android build numbers do not block the iOS build.
- [ ] Exercise friends/room invitations, chat moderation/reporting, clubs, and other enabled features used by the wave.
- [ ] Check notification permission refusal and, if APNs is configured, delivery to a physical iPhone. Declining notifications must not block play.
- [ ] Open the privacy policy, use support/feedback, and test account deletion only with a disposable test account.
- [ ] Update from one available TestFlight build to the next and confirm stored account progress persists.

The preparation pass completed the iOS JavaScript export, production browser export, full Railway-equivalent build, client lint/typecheck, 225 server tests, and five browser-dialog tests. A local browser smoke test verified sign-in/logout, room creation/leaving, solo card actions, and a keyboard-operable login-error dialog. The server integration suite includes mixed iOS/Android/web protocol clients and shared account data. These checks do not prove that a signed app launches on a physical iPhone. Complete the physical-device checks before expanding the wave, and record the final verification outcome for the exact source used to build.

## 10. Privacy and Apple review answers

Privacy policy: [Nine Below privacy policy](https://ninebelow.potterwell.com/privacy). Terms: [Nine Below terms](https://ninebelow.potterwell.com/terms). Copy preparation: [TestFlight copy and privacy inventory](../store-assets/apple/testflight-copy.md).

The configured `usesNonExemptEncryption: false` declaration is based on the app using exempt operating-system security such as HTTPS/TLS and platform credential storage, rather than custom non-exempt encryption. The declaration covers embedded dependencies too; re-evaluate it if the client gains another encryption implementation. The server's encrypted database fields are a separate server-side concern. Answer any Apple encryption questionnaire according to the actual shipped binary. [Apple encryption guidance](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)

The iOS privacy manifest is an implementation declaration about native API use. It does not replace the App Store Connect privacy questionnaire. Current manifest reasons cover file timestamps and user defaults; native dependencies and Apple's processing results must also be checked. [Expo privacy manifests](https://docs.expo.dev/guides/apple-privacy/)

Disclose the data actually collected and its real purpose. Accounts, gameplay records, chat/support content, and associated technical records mean that **"we do not collect data" is not an appropriate blanket answer**. The copy file provides an inventory to reconcile against the release, not a preapproved legal declaration. [Apple app-privacy instructions](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)

Apple's social-login rule is why this beta consistently uses first-party credentials on iOS. Adding Google/Facebook later requires meeting guideline 4.8, normally through an equivalent privacy-preserving login such as Sign in with Apple. Account deletion and privacy access must remain usable inside the app. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/#login-services)

## 11. Updates, expiry, and common blockers

- **Refresh TestFlight after upload:** processing and review status are in App Store Connect; users should open TestFlight → Nine Below and check the offered build. Availability follows group assignment and any review, not merely a finished EAS build.
- **Each TestFlight build expires after 90 days:** prepare a replacement before expiry, increment `ios.buildNumber` in `client/app.config.js` beyond the current `2`, build, upload, assign it to the correct groups, verify availability, and only then publish its release policy. The display version can remain `0.1.0` during these beta builds.
- **Build 1 crashes immediately:** use the corrected **0.1.0 (2)** once available in TestFlight. The [replacement record](ios-testflight-build-2.md) explains the native registration defect and launch-verification steps. Do not delete the player's account or reset shared data to work around this binary failure.
- **Bundle ID missing:** register it in the correct developer team, then refresh App Store Connect.
- **Missing signing credentials:** complete the interactive Apple/EAS setup; a simulator archive cannot replace an App Store-signed IPA.
- **Missing Compliance:** review the encryption answer for the actual binary before distributing.
- **Tester not listed under Internal Testing:** check their accepted App Store Connect invitation and role. Ordinary friends belong in a private external group instead.
- **"This beta isn't accepting testers":** verify the invitation, group, approved build, build expiry, device compatibility, and tester limit. A disabled public link is expected for email-only groups.
- **Game asks for an invite code:** the player is creating a new Nine Below account; provide a valid game signup code or log in to the existing account.
- **Google/Facebook-only account fails on iOS:** use the verified staff-assisted password path above; do not create a duplicate player account.
- **Push does not arrive:** check APNs credentials, the app's notification permission, physical-device registration, and server delivery logs independently of the binary upload.
- **App launches but cannot join:** check backend health, invite/account status, release policy, and live-operations controls; confirm both clients use the same backend and compatible protocol.

[Apple internal build lifetime](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers) and [Expo TestFlight workflow](https://docs.expo.dev/submit/testflight/).

## Information needed to start the selected testing wave

The app record, numeric Apple ID, Team ID, signing credentials, APNs key, and EAS Submit credential are configured. The first build/upload and Apple's processing are complete. The remaining information/actions are:

1. Any additional owner-selected testers' email addresses and whether they are trusted staff or ordinary private testers. The first ordinary external tester is recorded in **Private Playtesters**; no additional recipients should be assumed or added to Git.
2. The owner-approved audience setting, then build **0.1.0 (2)** processing/approval, group assignment, and verified tester availability. See the [current release record](ios-testflight-build-2.md); build 1's testing availability does not establish build 2's availability. A tester creating a new Nine Below account also needs a separately supplied game signup code.
3. Keep the saved feedback/review contact details current and monitored and the dedicated non-administrator review account usable. Its credentials are stored privately as described above, not in this repository.
4. A physical-device TestFlight installation and the acceptance checks above, including cross-platform play and push notifications. Fresh authentication is needed only if Apple/EAS requests it again.

The IPA checksum/location and Apple processing result are recorded above. Add the tester group and physical-device test outcome after the selected participants successfully install it. Successful compilation and Apple processing are not proof that the binary launches and plays correctly on a physical device.
