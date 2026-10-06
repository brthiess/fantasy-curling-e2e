# Fantasy Curling E2E (Playwright)

Standalone, deterministic Playwright integration/E2E repository for the fantasy curling platform.

## Career UI flow

Run `npm run test:e2e:career` for the isolated career/profile/recap browser tests.
This starts the local frontend on port 5187 and mocks API/auth responses; it needs
neither MongoDB nor production credentials. Backend calculations and API behavior
are covered separately by the backend Jest tests.

If Playwright's browser is unavailable, set `E2E_BROWSER_CHANNEL=msedge` to use
installed Edge. Desktop/mobile screenshots are saved under `test-results/career`.
The flow covers signing in, the dashboard career link, filters, a completed recap,
clipboard sharing, and anonymous access to a direct public recap link.

## What this repository provides

- Fresh isolated MongoDB per run via Testcontainers (no shared DB state).
- Automatic backend + frontend startup during Playwright global setup.
- Deterministic Mongo seed data for `Users`, `Tournaments`, and `Teams`.
- Strict `data-testid`-based page objects and smoke coverage.
- Failure artifact capture (`trace`, `video`, `screenshot`) for CI and local debugging.
- Azure DevOps pipeline example (`azure-pipelines/playwright-e2e.yml`).
- Placeholder scaffolding for future synthetic monitoring and journey expansion.

## Repository structure

```text
.
├─ config/
│  └─ testids.ts
├─ scripts/
│  ├─ global-setup.ts
│  ├─ global-teardown.ts
│  ├─ http-utils.ts
│  ├─ process-utils.ts
│  ├─ runtime-state.ts
│  ├─ seed-mongo.ts
│  ├─ start-backend.ts
│  ├─ start-frontend.ts
│  └─ start-mongo.ts
├─ tests/
│  ├─ e2e/
│  │  └─ smoke.spec.ts
│  ├─ factories/
│  │  └─ seed-data.ts
│  ├─ fixtures/
│  │  └─ test-fixtures.ts
│  └─ pages/
│     ├─ account-page.ts
│     ├─ auth-page.ts
│     ├─ common-page.ts
│     ├─ leaderboard-page.ts
│     └─ tournament-page.ts
├─ azure-pipelines/
│  └─ playwright-e2e.yml
├─ .env.example
├─ package.json
├─ playwright.config.ts
└─ tsconfig.json
```

## Prerequisites

- Node.js 20+
- Docker/Podman (preferred for Testcontainers MongoDB startup)
- Optional fallback: local/external Mongo reachable by `MONGO_URL`
- Local checkouts of:
  - Vue frontend (`npm run dev -- --mode devlocal`)
  - Node TypeScript backend (`npm run start:dev`)

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy env template:

   ```bash
   cp .env.example .env
   ```

3. Update `.env`:
   - `FRONTEND_DIR` and `BACKEND_DIR` to your local SUT directories
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_ENV`
   - If Docker/Podman is not running, set `MONGO_URL` to an external Mongo instance
   - Optionally `CMS_AUTH` (only if CMS flows are tested)
   - Keep `SUPABASE_PROJECT_ID` unset for deterministic local JWT mode

4. Install Playwright browser:

   ```bash
   npx playwright install chromium
   ```

5. Run smoke suite:

   ```bash
   npm run test:e2e:smoke
   ```

## Runtime behavior (deterministic)

On `playwright test`, global setup does the following in order:

1. Attempts a fresh Mongo container (`mongo:7`) using Testcontainers.
   - If container runtime is unavailable and `MONGO_URL` is set, uses that as fallback.
2. Seeds deterministic documents into `curling_test`:
   - `Users`
   - `Tournaments`
   - `Teams`
3. Starts backend with:
   - `MONGO_URL=<container mongo or external fallback>`
   - `NODE_ENV=test`
4. Waits for backend readiness (`GET /` by default, overridable with `BACKEND_READY_ENDPOINT`).
5. Verifies seeded collections exist before tests run.
6. Starts frontend and waits for SPA availability.
7. Runs Playwright tests with:
   - `timezoneId=UTC`
   - reduced motion
   - frozen browser time (`2026-02-10T15:00:00.000Z`)
8. On teardown:
   - stops frontend/backend processes
   - force-removes Mongo container

## Implemented smoke journeys

From `tests/e2e/smoke.spec.ts`:

- Auth:
  - sign-up route + submit flow
  - sign-in flow
  - reset-password route + submit flow
- Tournament:
  - join tournament
  - make 6 picks
  - save picks
- Leaderboard:
  - verify deterministic rank and score
- Account:
  - update settings save flow

Future placeholders are explicitly declared with `test.fixme` for:

- private tournament creation
- invite users
- payments/upgrade
- admin pages

## Required API contract assumptions

The journey suite expects these backend endpoints:

- `GET /api/current-user`
- `POST /api/current-user/settings`
- `POST /api/current-user/tournament-registrations/:id`
- `POST /api/current-user/picks/:tournamentId`
- `GET /api/sign-out`

Backend readiness uses `GET /` now and is ready for future `/health/ready`.

## Selector strategy (strict)

All selectors are `data-testid` only and centralized in `config/testids.ts`.

Do not use:

- CSS class selectors
- text-only selectors
- sleeps/timeouts for state sync

Page objects encapsulate selectors and async waits for:

- auth forms/buttons
- tournament CTAs
- picks controls
- leaderboard rows/cells
- account save flow
- modal/global loading states

## Flake prevention controls

- Single-worker local default for deterministic smoke run ordering.
- UTC timezone in browser + service processes.
- Frozen browser time to avoid date-boundary behavior.
- CSS animation/transition suppression.
- Explicit waits for route stabilization and loading/modal disappearance.
- No arbitrary `sleep`.

## Failure artifact workflow

Configured in `playwright.config.ts`:

- `trace: retain-on-failure`
- `video: retain-on-failure`
- `screenshot: only-on-failure`

Useful commands:

```bash
npm run show-report
npm run trace:open -- test-results/artifacts/<trace-file>.zip
```

## Local debugging workflow

- Headed run:
  - `npm run test:e2e:headed`
- Inspector/debug mode:
  - `npm run test:e2e:debug`
- Interactive Playwright UI:
  - `npm run test:e2e:ui`

Process logs are written under `.e2e-runtime/` for backend/frontend startup debugging.

## Azure DevOps CI

Example pipeline is included at:

- `azure-pipelines/playwright-e2e.yml`

It installs Node + Playwright, runs smoke tests, and publishes:

- `playwright-report`
- `test-results`

## Notes for synthetic monitoring expansion

This repo is intentionally structured for future staging synthetic journeys:

- Reusable page-object layer
- Deterministic data factories
- Startup orchestration hooks
- Selector contracts in a single config file

To expand, add suites under `tests/e2e/` and keep smoke coverage as the low-flake gate.
