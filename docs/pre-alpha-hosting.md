# Nine Below Pre-Alpha Hosting Runbook

This is the repeatable path for letting invited testers play Nine Below from anywhere, without Expo Go and without your home Wi-Fi server.

## Target Setup

- Pre-alpha API and sockets: `https://ninebelow.potterwell.com`
- Pre-alpha admin console: `https://ninebelow.potterwell.com/admin`

The staging mobile build, admin console, Socket.IO server, accounts, coins, clubs, shop, ranked, wagers, and results all need to point at the same hosted backend and the same database.

## Railway Backend Hosting

Railway is the first pre-alpha host.

Create one Railway project with two services:

- `Nine Below Server`: deployed from the GitHub repository, using `server` as the root directory.
- `Postgres`: Railway managed Postgres.

For the server service:

- The repo includes `railway.json`, so Railway can build from the repository root.
- Build command: `npm --prefix server install`
- Start command: `npm --prefix server start`
- Health check path: `/health`

`railway.json` sets deployment overlap to zero and allows two seconds for graceful shutdown. The `/health` deployment probe starts a five-second persistence handoff: the incoming process waits for the previous process to flush and stop, reloads the authoritative PostgreSQL state, and only then accepts state-changing HTTP requests or Socket.IO connections. `/health/ready` remains the operational readiness check. A process that ever encounters `STALE_STATE_WRITE` exits nonzero so Railway's `ON_FAILURE` policy replaces it instead of leaving a fenced instance online. Keep the server at one replica until persistence is migrated away from whole-state snapshot writes.

Railway can expose a service publicly from the service settings under Networking. Railway custom domains require the DNS records Railway shows, usually a CNAME plus a TXT verification record.

Required staging environment variables:

```bash
NODE_ENV=production
APP_ENV=staging
PORT=<provided by host>
DATABASE_URL=<managed postgres url>
DATABASE_SSL=1
DATABASE_SSL_REJECT_UNAUTHORIZED=1
DATABASE_SSL_CA=<public Railway root.crt PEM, with line breaks stored by Railway>
DATABASE_SSL_CA_SHA256=<verified SHA-256 fingerprint of root.crt>
DATABASE_SSL_RAILWAY_PRIVATE_HOSTNAME_COMPAT=1
TRUST_PROXY_HOPS=1
CLIENT_ORIGINS=*
PUBLIC_API_URL=https://ninebelow.potterwell.com
ADMIN_PUBLIC_URL=https://ninebelow.potterwell.com/admin
REQUIRE_INVITE_CODE=1
SEED_ADMIN_ACCOUNT=0
SEED_TEST_ACCOUNTS=0
ADMIN_BOOTSTRAP_USER=<private admin username>
ADMIN_BOOTSTRAP_PASSWORD=<strong private password>
ADMIN_BOOTSTRAP_MFA_CODE=<private six digit code>
ADMIN_SMTP_USER=donotreply@potterwell.com
ADMIN_SMTP_PASS=<unique no-reply mailbox password>
ADMIN_SMTP_FROM=donotreply@potterwell.com
SUPPORT_INBOX_EMAIL=app-developer@potterwell.com
SERVER_TOKEN_SECRET=<independent random secret, at least 32 characters>
EARLY_ACCESS_PII_KEY=<independent random secret, at least 32 characters>
EARLY_ACCESS_TOKEN_SECRET=<independent random secret, at least 32 characters>
EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED=0
EARLY_ACCESS_POSTAL_ADDRESS=<Potterwell postal address used in campaign footers>
EARLY_ACCESS_REPLY_TO=donotreply@potterwell.com
EARLY_ACCESS_EMAILS_PER_MINUTE=60
```

Do not use local defaults such as `admin`, `admin9`, or `000000` in staging or production.

The Railway Postgres private-network connection uses authenticated TLS with the database service's public `root.crt` pinned in `DATABASE_SSL_CA`. The server verifies that certificate's SHA-256 fingerprint before connecting and lets Node verify the presented server certificate against that pinned CA. Railway's generated server certificate currently names `localhost` rather than `postgres.railway.internal`, so `DATABASE_SSL_RAILWAY_PRIVATE_HOSTNAME_COMPAT=1` permits only that exact certificate-name substitution and only for the configured `*.railway.internal` database host. An unrelated hostname or certificate is still rejected. The service refuses to start in production when `DATABASE_SSL=0`, the pin is malformed, or the compatibility mode is incomplete.

Retrieve only `/var/lib/postgresql/data/certs/root.crt` from the Railway Postgres service and verify its fingerprint independently before configuring it. Never retrieve, download, or expose `root.key` or `server.key`. If Railway regenerates the database certificates, obtain and verify the new public CA, update `DATABASE_SSL_CA` and `DATABASE_SSL_CA_SHA256` together, and confirm `/health/ready` immediately after deployment.

Keep `SERVER_TOKEN_SECRET`, `EARLY_ACCESS_PII_KEY`, and `EARLY_ACCESS_TOKEN_SECRET` independent and stable. Rotating the server-token secret invalidates stored sessions, invite verifiers, and public support links. Never place their values in source control, screenshots, exports, or documentation.

## DNS

In Railway:

1. Open the `Nine Below Server` service.
2. Go to `Settings`.
3. Open `Networking`.
4. Generate a Railway domain first and confirm `/health` works.
5. Add custom domain `ninebelow.potterwell.com`.
6. Railway will show DNS records to add in SiteGround.

In SiteGround DNS:

- Add the CNAME Railway gives you for `ninebelow.potterwell.com`.
- Add the TXT verification record Railway gives you.

The admin console is served by the same backend at `/admin`, but with admin login and permissions.

## Invite-Only Signup

Staging should run with:

```bash
REQUIRE_INVITE_CODE=1
```

Then open the admin console and create invite codes:

1. Go to `https://ninebelow.potterwell.com/admin`.
2. Log in with the private admin credentials.
3. Open `Invites`.
4. Create one code per tester or a small batch code with limited uses.
5. Send the code with the staging app install link.

Existing approved accounts can log in normally. New accounts must enter a valid invite code.

## Early Access Registration And Waves

See the complete [Early Access Operations Guide](early-access-operations.md) for registration controls, testing waves, campaigns, exports, privacy, retention, and emergency shutdown procedures.

The public signup page is `https://ninebelow.potterwell.com/early-access`. Registration is paused by default even after deployment.

Before opening it:

1. Configure SMTP with `donotreply@potterwell.com` as the authenticated sender and reply-to address, plus SPF, DKIM, and DMARC records. Keep `app-developer@potterwell.com` as the monitored internal support destination.
2. Configure both early-access secrets and the Potterwell postal address.
3. Leave `EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED=0` while testing confirmation, preferences, and unsubscribe with staff addresses.
4. In Admin Console > Early Access, confirm every readiness indicator is green and open registration with an audit reason.
5. Keep `REQUIRE_INVITE_CODE=1` before scheduling an access campaign. Selection/onboarding campaigns can run before the game invite gate is enabled.
6. Use the Google Play CSV export to add ready Android testers to the closed-testing list before sending their access wave.
7. Configure the current Google Play opt-in or TestFlight URL in each access campaign, send an admin test copy, preview the recipient count, and then schedule the controlled wave.

Set `EARLY_ACCESS_CAMPAIGN_EMAIL_ENABLED=1` only after sender verification, links, one-use game codes, feedback routing, and unsubscribe have passed the production smoke test.

Production campaign workers must use PostgreSQL. Recipient deliveries use deterministic IDs and `FOR UPDATE SKIP LOCKED` leases so restarts or multiple server instances cannot claim the same queued message at the same time.

## Mobile Staging Builds

The staging EAS profile is configured to use:

```bash
EXPO_PUBLIC_APP_ENV=staging
EXPO_PUBLIC_STAGING_SERVER_URL=https://ninebelow.potterwell.com
```

Build Android internal distribution first:

```bash
cd client
npx eas build --platform android --profile staging
```

Send the EAS internal install link to 2-5 smoke testers first. After the smoke test is clean, send it to 10-25 trusted testers.

For iOS, use TestFlight once the Apple developer account and app record are ready:

```bash
cd client
npx eas build --platform ios --profile staging
```

TestFlight external testers require Apple beta review.

## Smoke Test Checklist

- Install the staging build on two devices on different networks.
- Confirm the app never shows `localhost`, a LAN IP, or `golf9.example.com`.
- Create accounts with invite codes.
- Log in, create a room, and join by code.
- Verify Socket.IO updates happen live across devices.
- Test Free Play, wager tables, ranked queue, chat, shop, profile, clubs, and admin actions.
- Change coins or cosmetics in the admin console and confirm the mobile app sees the change.
- Restart the backend and confirm accounts, coins, cosmetics, clubs, ranked, wagers, and results persist.

## Scaling Order

1. Private staging backend with Postgres.
2. Android staging build for 2-5 outside-Wi-Fi testers.
3. Invite-only pre-alpha for 10-25 testers.
4. Google Play internal or closed testing.
5. TestFlight.
6. Larger groups after logs, crashes, and disconnects look stable.

## Operational Guardrails

- Keep staging and production databases separate.
- Back up staging Postgres before larger test waves.
- Keep admin credentials private.
- Disable dev/test account seeding in hosted environments.
- Require invite codes in staging until you intentionally open signup.
- Watch failed logins, disconnects, server errors, socket room errors, and player support reports in the admin console.
