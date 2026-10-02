# AutoChip Finder

An offline-first automotive chip and module reference app for technicians using CG100X and iProg Pro.

## Run & Operate

- `pnpm install --frozen-lockfile` — install the imported workspace dependencies.
- Start the existing `artifacts/autochip-finder: expo` workflow to run the mobile app. Its configured command is `pnpm --filter @workspace/autochip-finder run dev`; Replit supplies its port and preview domains.
- Start `artifacts/api-server: API Server` for the API. Its command is `pnpm --filter @workspace/api-server run dev`; it listens on the injected `PORT`.
- Open **Preview on your phone** in Replit and scan the QR code with Expo Go to use the offline library on Android.
- `pnpm --filter @workspace/autochip-finder run typecheck` — check the mobile app.
- From `artifacts/autochip-finder`, run `CI=1 pnpm exec expo install --check` and `pnpm dlx expo-doctor@latest` to check Expo compatibility.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- No user-provided secrets or external services are required for the current mobile app or API health endpoint. The mobile library uses local SQLite. The unused PostgreSQL package needs `DATABASE_URL` only if it is later connected to the API.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Mobile DB: on-device SQLite through expo-sqlite; an unused PostgreSQL + Drizzle workspace package is also present
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The browser preview intentionally shows “Open the mobile preview”: its offline SQLite worker cannot initialize behind the Replit preview proxy. Use native Expo Go for library features; the browser notice is not a native database failure.
- React Native's optional desktop DevTools executable cannot launch in this Linux environment because a shared library is missing. Metro still starts and serves the app; this does not block Expo Go.
- The imported Canvas sandbox has React type conflicts in its calendar and spinner components. Mobile and API type checks pass independently, but the root type-check command includes Canvas and currently fails there.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
