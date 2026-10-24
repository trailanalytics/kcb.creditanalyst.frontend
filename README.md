# KCB Credit Analyst 3.0 - frontend

Vue 3 + TypeScript + Tailwind SPA replacing the Blade/Vue 2 pages in `creditanalyst.kcb`. Same UX and look, talking to the
Spring Boot API in `../kcb.creditanalyst.backend` over same-origin `/api/v1`.

## Develop

Node 26 LTS (`.nvmrc`; 24+ works):

```bash
npm ci
npm run dev          # http://localhost:5173, proxies /api to http://localhost:8080 (VITE_API_PROXY to change)
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e     # Playwright with the API mocked (npx playwright install chromium once)
npm run test:uat     # the UAT against the real compose stack, see below
```

## UAT (real stack, nothing mocked)

`e2e/uat` holds the executable acceptance tests (`playwright.uat.config.ts`). They need the compose stack of the backend repository
with the seed loaded (`scripts/uat/seed.sh`) and this app running with `/api` forwarded to it:

```bash
VITE_API_PROXY=http://localhost:8080 npm run dev -- --port 5173
UAT_BASE_URL=http://localhost:5173 npm run test:uat
```

How to start everything, the users and data, and the paper script these tests belong to: `docs/uat/` in the backend repository.

## Docker

```bash
docker compose up --build              # nginx on :8081, /api -> backend on the host's :8080
docker compose --profile dev up dev    # Vite dev server with hot reload
```

## Layout

`src/layouts` (App/Blank), `src/pages`, `src/stores` (Pinia), `src/api` (axios), `src/directives/can.ts` (`v-can`),
`src/styles/main.css` (Tailwind theme tokens from the Laravel theme). Feature modules arrive under `src/modules/<module>`
mirroring the backend modules.

Notes: TypeScript is pinned to 6.0.x because typescript-eslint does not support 7.x yet. Vue 3.5 is the current stable line.
Tracking: Linear project "Credit Analyst 3.0 - Java/Vue Transition".
