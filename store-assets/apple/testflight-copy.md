# Nine Below: Apple beta copy and release worksheet

Prepared September 21, 2026 for version **0.1.0**, iOS build **1**, bundle ID **com.potterwell.ninebelow**. SKU: **ninebelow-ios**.

This is copy for the first private TestFlight release. **Version 0.1.0 (1) is signed, uploaded, processed by Apple, and submitted for external TestFlight App Review on September 21, 2026. Its current UI status is Waiting for Review.** The earlier noninteractive signing blocker was resolved. The build is assigned to the private, email-only external tester group and automatic tester notification is enabled. Approval, email delivery, and physical-device installation are not yet verified. None of this copy announces a public App Store launch.

See the [step-by-step setup guide](../../docs/ios-testflight-guide.md) for account creation, signing, upload, tester groups, and rollout controls.

## New App fields

| Field | Value |
| --- | --- |
| Platform | iOS |
| Name | Nine Below |
| Primary language | English (U.S.) |
| Bundle ID | com.potterwell.ninebelow |
| SKU | ninebelow-ios |
| Public developer name | Ninebelow, A Registered Series Of Potterwell LLC |
| App Store Connect Apple ID | 6814632886 |
| Apple Team ID | 63FQJRQ66P |
| User Access | Full Access at creation; Apple disabled Limited Access in the first-app form. Restrict future staff access where supported. Ordinary testers receive no console role. |

## Beta app description

Nine Below by Potterwell is a multiplayer card game inspired by the traditional game of Golf. Reveal and replace cards, read the table, and aim for the lowest score.

This private beta helps us test the iPhone and iPad experience and shared online matches with Android players. Browser play will join testing when its deployment is ready. Use your Nine Below display name and password to access the same player account on supported platforms. New accounts may require a separate Nine Below invite code.

The game is in development. Features, balance, rewards, and progress may change during testing. Please share bugs, confusing interactions, and device-specific problems through TestFlight feedback or the game's support tools.

## What to Test

Please focus on:

1. Installing and launching Nine Below from TestFlight, including a fresh launch after closing it.
2. Creating an invited account and signing in with your Nine Below display name and password.
3. Joining the same room as Android players and completing a full game. Include browser players when a tested browser build is available.
4. Turn order, card actions, final scores, rewards, and the results screen.
5. Returning after switching apps, briefly losing a connection, or changing between Wi-Fi and mobile data.
6. iPhone and iPad layout, keyboard behavior, readable text, sound, and notification permissions.
7. Seeing the same account and progress when you use your credentials on another supported platform.
8. Support, reporting, and account controls. Use a disposable test account if checking account deletion.

For each issue, please include the device model, iOS version, Nine Below version/build, steps to reproduce, expected result, and what happened. Screenshots or a screen recording are helpful when they do not contain passwords, invite codes, or someone else's private information.

Use a different player account on each device when playing against yourself for testing. Google/Facebook sign-in and Sign in with Apple are not available in this initial iOS beta.

## TestFlight feedback and review contact

| Field | Entry/action |
| --- | --- |
| Feedback Email | `app-developer@potterwell.com`, saved in TestFlight; keep this destination monitored throughout testing |
| Privacy Policy URL | https://ninebelow.potterwell.com/privacy |
| Terms URL | https://ninebelow.potterwell.com/terms |
| Review contact first/last name | Saved directly in App Store Connect; keep personal contact details out of this worksheet |
| Review contact phone/email | Saved directly in App Store Connect; keep current and monitored |
| Sign-in required | Yes for account-based online play; a dedicated ordinary game review account is provisioned |
| Reviewer username/password | Saved privately in Apple's beta review details; recovery instructions are in the setup guide, never plaintext credentials in this file |

`donotreply@potterwell.com` is the intentionally unmonitored outbound sender. It is unsuitable as the beta feedback destination unless monitoring arrangements change. The existing support destination is separate from the public sending identity.

## Beta review notes

Nine Below is a multiplayer card game by Potterwell. The review build uses the same Nine Below backend as our Android testing release. It supports first-party display-name/password accounts on iOS. Google/Facebook sign-in is limited to Android in this beta; Sign in with Apple has not been added.

New player signup may be restricted with Nine Below invite codes during testing. The supplied reviewer account is already provisioned for access, so an additional signup code should not be required for review. Please contact the listed review contact if account access is unavailable.

The player account controls include account deletion. Please use the supplied disposable review account for destructive tests. The privacy policy is available at the URL supplied in the app's metadata.

The review account passed live password sign-in and account retrieval checks; its attempt to access the admin API was rejected with HTTP 401. Native installation and sign-in through the uploaded binary remain unverified. Before submitting these notes, reconcile them with the actual build and testing results. If online review requires a second player, arrange and describe a reproducible supported test path rather than promising always-available live opponents.

## Private external distribution record

The **Private Playtesters** group (`0716e498-8de2-45cb-9510-ad247deaf9f7`) shows **1 Tester · 1 Build**: one owner-selected external tester and build **0.1.0 (1)**. Review was submitted on **September 21, 2026** and the build shows **Waiting for Review**. Automatic tester notification is enabled; no public invitation link has been created. Apple approval, invitation email delivery, and installation are not yet verified. Keep recipient names and email addresses in App Store Connect, not in this repository, and do not grant ordinary play testers App Store Connect roles.

After approval, verify the selected build is available in this group and that Apple's automatic email invitation reaches the selected tester. Privately provide a separate Nine Below signup code if the tester needs a new game account. First confirm a successful installation and launch before expanding the group. See the [private testing and reviewer recovery instructions](../../docs/ios-testflight-guide.md#private-external-group-for-selected-people).

## Private tester welcome message

You have been selected to help test Nine Below by Potterwell on iPhone or iPad.

Install Apple's TestFlight app, open your Apple testing invitation on the device, and install Nine Below. For this private wave, only the selected testers will receive invitations.

If you already have a Nine Below display name and password, use those credentials so you keep the same account. If you are creating a new account, use the separate Nine Below invite code provided privately. Your Apple invitation and Nine Below game invite code are different.

If you have only used Google/Facebook sign-in on Android, contact Potterwell before creating another account; staff can help you enable password access to the existing profile. This first iOS beta uses display-name/password login.

Please test a full game with Android friends, reconnect after briefly switching apps, and report any crashes, scoring problems, or confusing screens. Include your device model, iOS version, app build, and steps to reproduce.

Thank you for helping us get Nine Below ready.

Do not send this message until the intended tester can actually install the build. Add confirmed wave dates and private account-access details only in the appropriate delivery system. Sending this draft is a separate action from preparing it.

## App Privacy: candidate inventory to verify

The following inventory is preparation for the App Store Connect questionnaire, not an assertion that every category is collected in this particular binary. Reconcile it with the shipped client, backend, enabled features, third-party services, and the privacy policy. Select collection purposes, linkage to identity, and tracking answers according to real behavior. Encryption does not make collected data exempt from disclosure.

| Candidate Apple data category | Nine Below behavior to inspect | Likely purpose to verify |
| --- | --- | --- |
| User ID / identifiers | Generated player ID, display name, sessions, account associations | Account functionality, security, multiplayer |
| Contact information | Early-access email/name, social-account data associated with existing players, support contact details where supplied | Access coordination, support, account functionality |
| Gameplay content / product interaction | Game history, results, rankings, progression, coins, cosmetics, clubs and friends | Gameplay and account functionality |
| User content | Chat, support tickets, bug reports, moderation reports | Communication, support and safety |
| Device identifiers / other technical data | Notification registration tokens, known-device/security identifiers, request logs | Notifications, security and service operation |
| Diagnostics | Actual crash/error/performance information collected by enabled services and support flows | Stability and troubleshooting |
| Purchases | Only actual paid purchase records if a payment feature is enabled; virtual game rewards alone do not establish paid purchases | Applicable purchase/account functionality |

Data used on the backend can still be collected through the app. First-party password signup does not necessarily collect an email address, but that does not eliminate support or other account-associated data. Confirm optional inputs and third-party processing separately. A TestFlight beta's Apple-collected feedback is also distinct from Nine Below's own collection.

Current iOS configuration declares **no tracking**, and excludes the Android Google/Facebook native integrations. Verify the built archive and actual enabled services before publishing the questionnaire. Do not select tracking merely because devices communicate with the same Nine Below server; do not select no tracking if a future integration changes the behavior.

The iOS manifest currently declares approved reasons for file timestamp and user-default APIs. It is separate from the public App Privacy labels and does not replace this inventory.

## Encryption answer preparation

The current app config sets `ios.config.usesNonExemptEncryption` to `false`, reflecting exempt platform security such as HTTPS/TLS and operating-system credential storage. This declaration also covers libraries shipped in the binary. Reassess it if client cryptography changes; server-only database encryption is a different component. If Apple asks about encryption, answer consistently with the inspected release rather than selecting "no encryption" merely to clear the screen.

## Release record — verified September 21, 2026

| Item | Status/value |
| --- | --- |
| App Store Connect numeric Apple ID | 6814632886 |
| Apple Team ID | 63FQJRQ66P |
| Source commit | `b819ef46193df3389359888c5e2461f007caa7e3` |
| EAS build ID | `4f98cb7c-246f-44a9-8668-db5197cc16fa`; finished at 20:34 UTC |
| Signed IPA / checksum | `artifacts/ios/build-1-4f98cb7c/nine-below-0.1.0-build-1.ipa` (Git-ignored); SHA-256 `c4cdf76a8dfdb4f1dedd180d0a4b4d195a7f8b31aa400ae981693171dc8328bb` |
| EAS submission ID/result | `81212592-c48a-430e-897c-674ae22f733b`; finished at 20:38 UTC |
| Apple processing/compliance result | VALID; internal READY_FOR_BETA_TESTING; external UI now Waiting for Review |
| Internal QA installation | Pending physical-device test |
| External beta approval | Review submitted September 21, 2026; Waiting for Review, not approved |
| Private external distribution | Build 0.1.0 (1) assigned to Private Playtesters; automatic notification enabled; email delivery/install not verified; no public link |
| iOS release policy | Keep unannounced until availability is verified |
| TestFlight expiry date | Record the date shown by Apple; each build lasts 90 days |

## Official references

- [Apple: create an app record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app)
- [Apple: internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers)
- [Apple: external testers and review](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
- [Apple: app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Apple: encryption declaration](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)
- [Apple: login-service review requirement](https://developer.apple.com/app-store/review/guidelines/#login-services)
- [Expo: iOS submission from Windows, macOS, or Linux](https://docs.expo.dev/submit/ios/)
- [Expo: TestFlight workflow](https://docs.expo.dev/submit/testflight/)
- [Expo: privacy manifests](https://docs.expo.dev/guides/apple-privacy/)
