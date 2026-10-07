---
name: Supabase DB connectivity
description: Connection method that worked for schema migrations to this app's external Supabase project from Replit.
---

For schema migrations from this Replit workspace, the Supabase Session Pooler connection URI worked. The direct PostgreSQL URI failed before SQL execution.

**Why:** In this workspace, the Session Pooler was the connection path that successfully reached the external database.

**How to apply:** Use the Session Pooler URI for future database migrations. Keep this privileged connection separate from the app's runtime `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
