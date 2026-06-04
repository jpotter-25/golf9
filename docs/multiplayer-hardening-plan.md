# Golf 9 Multiplayer Production Hardening Plan

This document tracks the phased effort to move Golf 9 from the merged authenticated multiplayer foundation to a testable production multiplayer app.

## Status legend
- ✅ Complete in current branch
- 🟡 In progress / partially complete
- ⛔ Blocked externally
- ⬜ Not started

## Iteration 1 — Safety and correctness hardening

Status: 🟡 In progress

### Goals
- Add automated coverage for shared rules and server auth/room/game intent flows.
- Make online held-card state reconnect-safe by including the viewer's server-held card in authoritative game snapshots.
- Harden game intent payload validation and cap duplicate-action tracking memory.

### Completed in this iteration
- ✅ Shared rules tests for scoring, peek validation, column-zeroing, and public viewer state.
- ✅ Server integration test for signup, create/join room, ready/start, invalid intents, out-of-turn rejection, duplicate action IDs, held-card enforcement, and reconnect restoration.
- ✅ Authoritative server now returns `viewerHeldCard` in per-user game state snapshots.
- ✅ Client restores online held card from `viewerHeldCard` on room join/reconnect and live game updates.
- ✅ Server validates intent type, action ID shape, and grid coordinates before applying actions.
- ✅ Duplicate action ID tracking is capped per room.

### Blocked / deferred
- ⛔ Native secure token storage via `expo-secure-store` is blocked in this environment by npm registry HTTP 403. Keep `sessionStorage` isolated so the adapter can be swapped once the dependency is available.

## Iteration 2 — Durable backend persistence

Status: ⬜ Not started

### Goals
- Replace JSON-file users/sessions and in-memory rooms with a real persistence layer.
- Add migrations and test fixtures.
- Persist completed game results and stats.

### Candidate acceptance criteria
- Users and sessions survive server restarts.
- Active rooms either restore safely or expire predictably.
- Completed results are queryable for profile stats.
- Storage layer has unit/integration tests.

## Iteration 3 — Deployment and real environments

Status: ⬜ Not started

### Goals
- Replace placeholder EAS project ID and placeholder staging/production API URLs.
- Deploy a staging backend.
- Lock down production CORS and environment variables.

### Candidate acceptance criteria
- Staging builds connect to staging API.
- Production builds connect to production API.
- Server rejects unexpected origins in production.
- EAS project metadata and signing setup are real.

## Iteration 4 — Observability and crash reporting

Status: ⬜ Not started

### Goals
- Add client crash reporting and server structured logging.
- Add request/socket correlation IDs.
- Prevent sensitive token/password logging.

## Iteration 5 — Internal test builds and manual validation

Status: ⬜ Not started

### Goals
- Produce TestFlight and Google Play internal testing builds.
- Run manual test checklist from `docs/internal-testing.md` across iOS, Android, and web if web remains in scope.
- Fix playtest bugs found during real-device multiplayer sessions.
