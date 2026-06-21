# Golf 9 Pre-Alpha Hosting Runbook

This is the repeatable path for letting invited testers play Golf 9 from anywhere, without Expo Go and without your home Wi-Fi server.

## Target Setup

- Pre-alpha API and sockets: `https://games.joinup.us`
- Pre-alpha admin console: `https://games.joinup.us/admin`
- Later production can stay on `games.joinup.us` or move to dedicated `api.` and `admin.` subdomains.

The staging mobile build, admin console, Socket.IO server, accounts, coins, clubs, shop, ranked, wagers, and results all need to point at the same hosted backend and the same database.

## Railway Backend Hosting

Railway is the first pre-alpha host.

Create one Railway project with two services:

- `Golf 9 Server`: deployed from the GitHub repository, using `server` as the root directory.
- `Postgres`: Railway managed Postgres.

For the server service:

- The repo includes `railway.json`, so Railway can build from the repository root.
- Build command: `npm --prefix server install`
- Start command: `npm --prefix server start`
- Health check path: `/health`

Railway can expose a service publicly from the service settings under Networking. Railway custom domains require the DNS records Railway shows, usually a CNAME plus a TXT verification record.

Required staging environment variables:

```bash
NODE_ENV=production
APP_ENV=staging
PORT=<provided by host>
DATABASE_URL=<managed postgres url>
DATABASE_SSL=0
CLIENT_ORIGINS=*
PUBLIC_API_URL=https://games.joinup.us
ADMIN_PUBLIC_URL=https://games.joinup.us/admin
REQUIRE_INVITE_CODE=1
SEED_ADMIN_ACCOUNT=0
SEED_TEST_ACCOUNTS=0
ADMIN_BOOTSTRAP_USER=<private admin username>
ADMIN_BOOTSTRAP_PASSWORD=<strong private password>
ADMIN_BOOTSTRAP_MFA_CODE=<private six digit code>
```

Do not use local defaults such as `admin`, `admin9`, or `000000` in staging or production.

## DNS

In Railway:

1. Open the `Golf 9 Server` service.
2. Go to `Settings`.
3. Open `Networking`.
4. Generate a Railway domain first and confirm `/health` works.
5. Add custom domain `games.joinup.us`.
6. Railway will show DNS records to add in SiteGround.

In SiteGround DNS:

- Replace the existing `games.joinup.us` A record that points at SiteGround.
- Add the CNAME Railway gives you for `games.joinup.us`.
- Add the TXT verification record Railway gives you.

The admin console is served by the same backend at `/admin`, but with admin login and permissions.

## Invite-Only Signup

Staging should run with:

```bash
REQUIRE_INVITE_CODE=1
```

Then open the admin console and create invite codes:

1. Go to `https://games.joinup.us/admin`.
2. Log in with the private admin credentials.
3. Open `Invites`.
4. Create one code per tester or a small batch code with limited uses.
5. Send the code with the staging app install link.

Existing approved accounts can log in normally. New accounts must enter a valid invite code.

## Mobile Staging Builds

The staging EAS profile is configured to use:

```bash
EXPO_PUBLIC_APP_ENV=staging
EXPO_PUBLIC_STAGING_SERVER_URL=https://games.joinup.us
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
