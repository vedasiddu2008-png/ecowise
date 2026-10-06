# EcoWise

EcoWise helps people turn everyday routines into practical sustainable choices. It analyzes an activity description, suggests lower-impact alternatives, and tracks completed actions with eco points, a streak, badges, and challenges.

## Features

- Email/password signup, sign-in, and password recovery through Supabase Auth
- Deterministic activity analysis that works without an AI provider or AI key
- Personalized recommendations saved with each activity
- Dashboard, searchable history, badges, challenge enrollment and progress, and editable profile
- Database-backed points, eco score, daily activity, and streak updates
- Responsive layouts, accessible controls, validation, loading, error, and empty states
- Row Level Security policies to keep private records scoped to the signed-in user

## Tech

- React, TypeScript, Vite, Tailwind CSS, Lucide React, and Recharts
- Express 5 API server with generated request/response validation from OpenAPI
- Supabase Auth and PostgreSQL, with a Supabase SQL schema in `supabase/schema.sql`

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `supabase/schema.sql` from this project. This creates the tables, indexes, RLS policies, user profile trigger, seed badges/challenges, and the atomic completion function.
3. In Supabase Authentication settings, enable email/password sign-in. If email confirmation is enabled, add the app's preview/published URLs to the allowed redirect URLs and confirm the address after signup.
4. In the Replit project's Secrets, set:
   - `SUPABASE_URL` — the project's URL
   - `SUPABASE_ANON_KEY` — the public anon key

The app does not need the service-role key. Its API validates the user's Supabase access token and uses that token for database requests; RLS remains active. The public anon key is delivered to the browser for Supabase Auth, where it is expected to be visible.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase public anon key |

The optional Gemini API integration is not required. Activity analysis and recommendations use the deterministic server-side fallback engine.

For local development outside Replit, copy `.env.example` to `.env` and add your Supabase project values. Do not commit `.env`.

## Run

Install dependencies from the workspace root:

```sh
pnpm install
```

The Replit preview runs the EcoWise web artifact, while the configured API Server workflow provides `/api`. Outside Replit, run both services in separate terminals:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/ecowise run dev
```

Check the workspace:

```sh
pnpm run typecheck
```

## Authentication and data flow

Supabase Auth owns account creation, sign-in, password recovery, and sessions. Protected API requests send the current Supabase access token in the Authorization header. The API confirms the token with Supabase, derives the user ID from the verified user, and performs database operations with that user's token so RLS policies apply.

Recommendation completion runs through one PostgreSQL function. The transaction prevents duplicate completion, updates points, eco score, activity totals, daily totals, streaks, challenge progress/rewards, and newly earned badges together.

## Analysis fallback

The analysis endpoint classifies the description using category keywords and returns practical recommendations for transportation, energy, water, food, shopping, waste, lifestyle, and other routines. It does not claim precise environmental savings. No AI API key is required.
