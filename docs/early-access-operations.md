# Nine Below Early Access Operations Guide

This guide explains how Potterwell staff operate the Nine Below early-access program after deployment. The public signup URL is [https://ninebelow.potterwell.com/early-access](https://ninebelow.potterwell.com/early-access), and the control panel is [https://ninebelow.potterwell.com/admin/](https://ninebelow.potterwell.com/admin/), under **Early Access**.

## The three controls that matter most

Early-access registration, participant progress, and campaign delivery are separate controls:

- **Public registration** controls whether the signup form is open, temporarily paused, or closed.
- **Participant stages** track where each tester is in the program. Changing a stage does not send an email by itself.
- **Campaign delivery** controls whether wave emails may leave the server. Registration can remain open while campaign delivery is disabled.

This separation lets Potterwell collect interest without accidentally releasing a build or emailing a wave.

## Open, pause, or close registration

1. Sign in to the admin console.
2. Open **Early Access**.
3. Under **Public Registration**, choose the desired state:
   - **Open** displays the signup form and accepts submissions.
   - **Paused** hides the form and shows a temporary status message. Existing records and confirmations remain intact.
   - **Closed** hides the form and shows a final closed message.
4. Enter a clear public status message.
5. Enter the required audit reason, such as `Pausing registration while the next testing wave is prepared.`
6. Select **Save Registration Status**.
7. Open the public early-access page in a private browser window and confirm the expected state.

Use **Paused** for routine temporary shutdowns. Use **Closed** when Potterwell no longer intends to accept signups for the current program.

## Emergency stop

If registration or campaign activity must stop immediately:

1. Set public registration to **Paused** in the admin console.
2. Cancel any scheduled campaigns that have not started.
3. In Railway, set `EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED=0` and deploy the configuration change.
4. Confirm the public page is paused and the admin readiness panel reports campaign delivery disabled.
5. Record what happened and the reason in the audit notes.

Disabling campaign delivery does not disable signup verification emails. To stop all early-access email, pause registration and disable or remove the SMTP configuration only as an emergency measure; doing so can also affect other administrative email features.

## Signup and consent lifecycle

The public form asks for an email address, iOS and/or Android interest, an optional first name, optional future browser interest, email consent, and confirmation that the applicant is at least 13.

Every applicant receives a double-opt-in verification email. The verification link expires after 48 hours and opens a page where the applicant must explicitly confirm. Automated link scanners cannot complete consent by merely opening the link.

Duplicate submissions return the same neutral response as new submissions so the site does not reveal whether an address is registered. A pending applicant may receive another verification email after the 15-minute resend cooldown. A confirmed applicant must verify control of the address before preferences change, and an unsubscribed applicant must complete a fresh double opt-in to rejoin.

Consent status and tester stage are independent:

- Consent: `pending`, `confirmed`, or `unsubscribed`.
- Tester stage: `waitlisted`, `selected`, `onboarding`, `ready`, `invited`, `activated`, or `declined`.

The normal tester path is:

`waitlisted` → `selected` → `onboarding` → `ready` → `invited` → `activated`

Use `declined` when a candidate declines or should no longer be considered. Add a note and audit reason whenever staff changes a stage or assists with consent.

## Preparing a testing wave

Before any wave:

1. Confirm the target build is available in Google Play closed testing or TestFlight.
2. Confirm the installation or opt-in URL works with a staff account.
3. Confirm `REQUIRE_INVITE_CODE=1` in Railway before an **access** campaign. Access-wave preflight will refuse to send if the game invite gate is disabled.
4. Confirm the admin Early Access readiness panel is green for SMTP, encryption keys, token signing, postal address, and campaign delivery.
5. Confirm the Potterwell mailing address and reply-to address are current.
6. Keep the wave small enough for the team to support and observe.
7. Preview the recipient count and message.
8. Send a test message to Potterwell staff and inspect both the HTML and plain-text versions, links, start date, sender details, and unsubscribe information.
9. Enter the required audit reason before scheduling.

Campaign types have different purposes:

- **Selection** tells waitlisted people they were selected and sends them to private onboarding.
- **Access** provides final installation instructions and a unique one-use Nine Below account invite code.
- **Update** communicates program or schedule information without granting access.

The campaign editor escapes staff-entered text and renders Potterwell-controlled email templates. It intentionally does not accept raw HTML.

## Android wave procedure

1. Filter for confirmed applicants interested in Android.
2. Select the intended candidates and move them to `selected`, recording an audit reason.
3. Send a **selection** campaign in a small wave.
4. Candidates complete private onboarding. They can provide the Google account used for Google Play, device model, and OS version, and must acknowledge the testing expectations and feedback instructions.
5. Review completed onboarding and move qualified candidates to `ready`.
6. Export the Google Play tester CSV as an Owner or Admin. The export protects cells against spreadsheet-formula injection.
7. Import the addresses into the intended Google Play closed-testing list and verify the closed-test opt-in URL.
8. Confirm the game invite gate is enabled with `REQUIRE_INVITE_CODE=1`.
9. Compose an **access** campaign with the Google Play opt-in URL, start date, testing focus, and feedback instructions.
10. Preview recipients, send a staff test, select a wave size, and schedule or send the campaign.
11. Monitor delivery records and Support Inbox feedback. Each recipient receives a unique one-use game invite code; successful code consumption moves the tester to `activated`.

Do not use the general CSV when Google Play tester format is required. Keep tester exports private and delete local copies when they are no longer needed.

## iOS wave procedure

1. Filter for confirmed applicants interested in iOS.
2. Move the chosen candidates to `selected` with an audit reason.
3. Send a **selection** campaign and have candidates complete onboarding.
4. Move qualified candidates to `ready`.
5. Create or verify a limited TestFlight public link for the intended build and tester limit.
6. Confirm the game invite gate is enabled with `REQUIRE_INVITE_CODE=1`.
7. Compose an **access** campaign with the TestFlight URL, start date, testing focus, and feedback instructions.
8. Preview, staff-test, and send a controlled wave.
9. Monitor delivery, invite activation, and feedback.

The TestFlight link controls access to the Apple build. The one-use Nine Below code separately controls account entry inside the game.

## Campaign controls and delivery status

Campaigns begin as `draft` and can become `scheduled`, `sending`, `completed`, or `cancelled`. Recipient delivery records can be `queued`, `sending`, `sent`, `failed`, or `skipped`.

Important behavior:

- The server claims queued deliveries transactionally, so restarts and multiple server instances do not intentionally schedule the same recipient twice.
- `sent` means the SMTP server accepted the message. It does not prove inbox placement or that the recipient read it.
- Known temporary failures use exponential retries.
- Permanent failures require staff review.
- **Retry Failed** retries eligible failed deliveries without rebuilding the entire campaign.
- Cancelling stops unsent work; it cannot recall messages already accepted by SMTP.
- The default send throttle is 60 recipients per minute and can be changed with `EARLY_ACCESS_EMAILS_PER_MINUTE`.

## Feedback and support

Access emails contain a signed feedback link. The form collects category, build, severity, reproduction steps, expected result, actual result, and optional device information. Submissions create Early Access-tagged tickets in the existing Support Inbox. File uploads are not included in the first version.

Support staff may view participants and help with stages or consent, but cannot export participant data or manage campaigns. Admins may read, manage, export, and send. Owners have unrestricted control.

## Privacy, exports, and retention

Email addresses, optional first names, and platform-account email addresses are encrypted in PostgreSQL. Case-insensitive duplicate detection uses a keyed value instead of searchable plaintext. Verification and preference tokens are random, stored only as hashes, expire, and are single-use.

Treat every participant export as sensitive personal information:

- Export only for a current operational need.
- Store it only in an approved Potterwell location.
- Do not email it casually or place it in a shared public folder.
- Delete temporary local copies after use.
- Record the purpose in the required audit reason.

Default retention rules are:

- Unconfirmed records: purge 30 days after the verification token expires.
- Active consent: request reconfirmation after 24 months and erase personal information if it is not reconfirmed.
- Unsubscribed records: erase personal information within 30 days, retaining only a keyed suppression value and minimal consent audit for 24 months.

Administrative sends, exports, stage changes, consent assistance, and erasure actions are recorded in the audit log.

## Railway production configuration

The NineBelow service uses these early-access variables:

| Variable | Purpose | Normal operating value |
| --- | --- | --- |
| `EARLY_ACCESS_PII_KEY` | Encrypts participant personal information | Stable secret of at least 32 characters |
| `EARLY_ACCESS_TOKEN_SECRET` | Signs and hashes early-access tokens | Different stable secret of at least 32 characters |
| `EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED` | Master campaign-delivery switch | `0` while only collecting signups; `1` only when waves are ready |
| `EARLY_ACCESS_POSTAL_ADDRESS` | Mailing address shown in campaign email footers | Current Potterwell mailing address |
| `EARLY_ACCESS_REPLY_TO` | Reply address for early-access messages | Monitored Potterwell address |
| `EARLY_ACCESS_EMAILS_PER_MINUTE` | Campaign throttle | `60` unless deliberately changed |
| `REQUIRE_INVITE_CODE` | Requires a valid game invitation during signup | `1` before any access wave |

SMTP uses the existing `ADMIN_SMTP_*` variables. Production readiness also requires the public/admin URLs and database configuration already used by the service.

Never rotate or remove `EARLY_ACCESS_PII_KEY` after participant records exist unless engineering performs a planned data migration. Losing or changing it makes existing encrypted personal information unreadable. Rotating `EARLY_ACCESS_TOKEN_SECRET` invalidates outstanding signed links and token lookups. Store both values only in Railway or another approved secret manager; never place them in source control, documentation, screenshots, chat, or exported files.

After any Railway variable change, wait for the deployment to become healthy and verify:

- [https://ninebelow.potterwell.com/health/ready](https://ninebelow.potterwell.com/health/ready)
- [https://ninebelow.potterwell.com/early-access/config](https://ninebelow.potterwell.com/early-access/config)
- The readiness panel under **Admin → Early Access**
- The public early-access page in a private browser window

## Routine operating checklist

At least weekly while registration is open:

- Review pending, confirmed, unsubscribed, selected, invited, and activated counts.
- Review the iOS/Android platform breakdown.
- Check failed email deliveries and retry only understood temporary failures.
- Review Early Access tickets in the Support Inbox.
- Confirm public signup and verification links still use HTTPS and work on mobile.
- Confirm the reply-to mailbox is monitored.
- Confirm no participant exports remain on personal devices unnecessarily.

Before each wave:

- Verify the build and installation link.
- Verify the invite gate.
- Verify campaign readiness and sender information.
- Preview the exact audience.
- Send and inspect a staff test.
- Record the wave purpose and audit reason.
- Start small, observe activation and support load, then expand deliberately.

After each wave:

- Monitor sent, failed, and skipped deliveries.
- Confirm invite activation is updating participant stages.
- Triage feedback tickets and communicate known issues.
- Pause the next wave if infrastructure, build stability, or support capacity is not ready.

