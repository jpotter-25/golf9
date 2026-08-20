# Nine Below Deep Security Scan Remediation Report

Date: 2026-08-20

Baseline revision: `31136a9ff5f63528ec04d04ca53b3409d9649667`

Deep-scan ID: `91161c74-fe69-4396-b21f-8b0e265cd76f`

Validated findings: 60 (18 high, 32 medium, 10 low)

## Scope and limitations

The source scan reviewed 183 files through 33 independent reviews and 25 passes. Coverage was partial because the Codex Security usage limit stopped additional discovery workers after three unsuccessful attempts. The scan was static and did not inspect deployed secrets, cloud control-plane configuration, or live production data. This report therefore records source remediations and local verification; it is not a claim that no vulnerabilities remain.

## Disposition

All 60 validated findings were remediated in the working tree and covered by focused inspection, automated regression tests, or both. No finding was waived. Production validation still depends on deploying the revision with the required secrets and verified Railway/PostgreSQL TLS configuration.

| # | Finding | Disposition | Remediation |
|---:|---|---|---|
| 1 | Hidden card ID disclosure | Fixed | Card IDs are opaque; draw/grid projections use viewer-safe synthetic IDs and pending-decision IDs are masked. |
| 2 | Client-authoritative local rewards | Fixed | Local results require idempotency IDs, are bounded, remain history-only, and grant no shared XP, currency, stats, achievements, or challenges. |
| 3 | Infinite local progression loop | Fixed | XP, currency, statistics, match telemetry, and normalization are finite and bounded before level calculations. |
| 4 | Known production credential seeding | Fixed | Test/dev accounts never seed in any hosted environment and bootstrap credentials must meet the strong policy. |
| 5 | Admin MFA online guessing | Fixed | Per-admin MFA failure accounting, eight-attempt lockout, and persisted TOTP counter replay protection were added. |
| 6 | Admin recovery flood/invalidation | Fixed | Recovery requests use a resend cooldown and aggregate failure/lock state without invalidating a still-valid request. |
| 7 | Support ticket PII overexposure | Fixed | Support PII is permission-gated and redacted for roles without `support:piiRead`. |
| 8 | Known-device metadata overexposure | Fixed | Device metadata requires `users:deviceRead`; ordinary user/admin projections omit it. |
| 9 | Admin recovery email disclosure in audit | Fixed | Recovery audit records no longer persist the submitted address. |
| 10 | Support bearer URL/lifetime | Fixed | Access uses a POST body, URL fragments in the browser, 30-day expiry, and explicit revocation. |
| 11 | Plaintext support PII at rest | Fixed | Names, email, website, subject, message, and notes are stored in an AES-256-GCM protected payload. |
| 12 | Private-room code admission | Fixed | Private rooms require a live invitation created by a current member. |
| 13 | Unbounded room allocation | Fixed | Active rooms have a configurable hard cap and room-code generation has a bounded attempt count. |
| 14 | Nonmember room-leave mutation | Fixed | Membership is checked before countdown/readiness mutation. |
| 15 | Spoofable device-ban identity | Fixed | Device bans are also bound to the authenticated user account. |
| 16 | Synchronous signup password hashing DoS | Fixed | Signup PBKDF2 is asynchronous and protected by IP throttling. |
| 17 | Early-access IP hash overexposure | Fixed | Consent-history projections remove IP hashes and private details from non-PII admin views. |
| 18 | Matchmaking provenance bypass | Fixed | Casual room creation ignores caller-supplied ranked/wager fields; server routes set match provenance. |
| 19 | Room game restart/replay | Fixed | A room can start only from a clean lobby with no existing game. |
| 20 | Socket session revocation gap | Fixed | Every privileged socket event revalidates the live session and current ban state. |
| 21 | Weak authoritative shuffle PRNG | Fixed | The server injects `crypto.randomInt`; browser clients use Web Crypto when available. |
| 22 | Push token cross-account binding | Fixed | Registering a token atomically removes the same token from every other account. |
| 23 | Expired early-access token revival | Fixed | Confirmed preference changes use a separate pending credential; active management tokens rotate only after verification. |
| 24 | Account deletion password throttle bypass | Fixed | Throttling uses both IP and a keyed account bucket. |
| 25 | Legacy admin MFA enrollment bypass | Fixed | Replacing legacy MFA requires a currently verified factor. |
| 26 | Admin MFA freshness disabled | Fixed | Sensitive admin operations require MFA verified within five minutes. |
| 27 | Catalog asset version leak | Fixed | Asset names use UUIDs and superseded unreferenced drafts are removed within the validated catalog directory. |
| 28 | Web bearer token in localStorage | Fixed | Web sessions use `sessionStorage`; native tokens and cached profiles use SecureStore. |
| 29 | Unbounded local result history | Fixed | Local history is capped at 250 records per user. |
| 30 | Authenticated support storage exhaustion | Fixed | Rate limits plus per-user active and total ticket bounds prevent unbounded allocation. |
| 31 | Admin same-site CORS exposure | Fixed | Exact admin-origin validation applies to every admin request method, not only mutations. |
| 32 | Socket payload exception DoS | Fixed | Every socket payload is normalized before field access. |
| 33 | Non-atomic mail reward claim | Fixed | PostgreSQL locks and updates the recipient, mail entry, and state revision in one transaction. |
| 34 | Resettable admin recovery attempts | Fixed | Failure state is aggregated on the admin rather than reset by issuing another code. |
| 35 | Account-deletion email enumeration | Fixed | Requests return a neutral response regardless of account existence. |
| 36 | Resettable account-deletion code attempts | Fixed | Attempts aggregate across all live requests for the account. |
| 37 | Admin login lockout enumeration DoS | Fixed | Password failures no longer create an attacker-controlled persistent account lock; route throttling remains. |
| 38 | Public deployment information disclosure | Fixed | Public health endpoints return only readiness booleans. |
| 39 | Default admin MFA secret | Fixed | Hosted bootstrap has no static code and must complete authenticator enrollment. |
| 40 | Optional database TLS verification | Fixed | Hosted deployments cannot disable TLS or peer verification; Railway CA pinning remains enforced. |
| 41 | Unkeyed short OTP verifiers | Fixed | Recovery/deletion codes use purpose-separated keyed HMAC verifiers. |
| 42 | Social-login outbound exhaustion | Fixed | Google, Facebook, and Expo requests have bounded timeouts and route throttles. |
| 43 | Unauthorized system-mail rewards | Fixed | Coin, cosmetic, and broadcast mail require the appropriate economy/cosmetic/notification permission. |
| 44 | Account-deletion error enumeration | Fixed | Password deletion failures use the same generic verification error. |
| 45 | Production social test identity | Fixed | Social-auth test mode fails startup in any hosted environment. |
| 46 | Cross-process stale snapshot overwrite | Fixed | PostgreSQL state revisions fence stale writers and readiness fails closed after a stale-write error. |
| 47 | Private room code in profiles | Fixed | Private codes are visible only to the player, room members, or a live invitee. |
| 48 | Stale club socket membership | Fixed | Administrative removal forces affected sockets out of the club channel. |
| 49 | Capability tokens in query strings | Fixed | Support and early-access capabilities are submitted in POST bodies and never put email addresses in URLs. |
| 50 | Account-deletion mail retention | Fixed | Deletion rewrites/removes mail using the actual `recipientUserId` association. |
| 51 | Weak player passwords | Fixed | New passwords require 12–128 characters with letters and numbers; simple predictable values are rejected. |
| 52 | Public club operational data | Fixed | Nonmembers do not receive treasury, goals, events, donation, prestige-cost, or reward state. |
| 53 | MFA rotation session revocation | Fixed | MFA confirmation rotates the admin auth version and revokes every other session. |
| 54 | Linkable deletion pseudonym | Fixed | Deleted account identifiers are random rather than derived from the original ID. |
| 55 | Admin audit retention eviction | Fixed | Audit entries are no longer memory-sliced and PostgreSQL persists them append-only. |
| 56 | Native profile cache PII | Fixed | Native cached profiles moved from AsyncStorage to encrypted platform SecureStore. |
| 57 | Private reveal projection | Fixed | Temporary reveal cards and their decision metadata are visible only to the deciding player. |
| 58 | Pre-MFA admin metadata | Fixed | Pre-MFA responses expose only display name and MFA enrollment state. |
| 59 | Social-link recent-auth bypass | Fixed | Provider linking requires a session authenticated within five minutes. |
| 60 | Public health security posture disclosure | Fixed | Detailed security/deployment health remains behind authenticated admin permissions. |

## Verification

- Server: 206/206 Node tests passed, including 43/43 end-to-end integration cases.
- Client: ESLint passed with zero warnings.
- Client: TypeScript `--noEmit` passed.
- Android: Expo production bundle export passed (3,045 modules; Hermes bundle generated).
- Focused security regressions prove TOTP replay rejection and lockout persistence, hosted TLS fail-closed behavior, stale-writer fencing, transactional mail claims, encrypted/redacted support storage, early-access token non-revival, hidden-card projection secrecy, malformed-socket resilience, private-room invite enforcement, and the local-result no-reward boundary.
- `git diff --check` must remain clean before commit.

## Deployment requirements

Hosted startup intentionally fails closed unless strong token, PII, and admin-MFA encryption secrets are configured. Railway must retain verified database TLS with the approved CA and fingerprint. After deployment, verify public readiness, authenticated admin health, database state revision writes, SMTP, signup/confirmation/unsubscribe, and one internal early-access campaign before opening enrollment.
