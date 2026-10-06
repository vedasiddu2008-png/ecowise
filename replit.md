# EcoWise

EcoWise helps people analyze everyday routines, get practical sustainable alternatives, and track progress through points, streaks, badges, and challenges.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/ecowise run dev` — run the EcoWise web app outside Replit
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB/Auth: Supabase PostgreSQL and Supabase Auth
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ecowise/` — EcoWise web app, Supabase schema, and setup guide
- `artifacts/api-server/src/routes/ecowise.ts` — authenticated EcoWise API
- `lib/api-spec/openapi.yaml` — API contract and source for generated types

## Architecture decisions

- Supabase Auth and PostgreSQL are used for user data because the product brief explicitly requires Supabase.
- The API uses the public anon key and each verified user's access token; it does not require a service-role key.
- Recommendation completion is atomic in PostgreSQL so points and streaks cannot be awarded twice for one recommendation.
- Analysis uses a deterministic keyword engine so the core flow works without an AI provider.

## Product

Users can analyze activities, complete recommendations, and track persisted progress in the dashboard, history, challenges, badges, and profile.

## User preferences

- The app should be modern, friendly, sustainable, slightly gamified, responsive on mobile and desktop, and avoid placeholder interactions.

## Gotchas

- Run `artifacts/ecowise/supabase/schema.sql` in the Supabase SQL Editor before signup or data features.
- Expose the Supabase URL and anon key through Replit Secrets; RLS protects the browser-visible anon key.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
