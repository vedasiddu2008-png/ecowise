import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Request, RequestHandler } from "express";

export type AuthenticatedSupabase = {
  client: SupabaseClient;
  user: User;
};

export class SupabaseConfigurationError extends Error {}

export class AuthenticationError extends Error {}

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabaseConfigurationError("Supabase is not configured");
  }

  return { url, anonKey };
}

export async function authenticateSupabaseRequest(
  req: Request,
): Promise<AuthenticatedSupabase> {
  const { url, anonKey } = getSupabaseConfig();
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new AuthenticationError("A valid session is required");
  }

  const accessToken = match[1];
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new AuthenticationError("A valid session is required");
  }

  return { client, user: data.user };
}

export const requireSupabaseUser: RequestHandler = async (
  req,
  res,
  next,
): Promise<void> => {
  try {
    res.locals.eco = await authenticateSupabaseRequest(req);
    next();
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      res.status(503).json({
        error: "EcoWise account storage is not configured yet.",
      });
      return;
    }

    if (error instanceof AuthenticationError) {
      res.status(401).json({ error: "Please sign in to continue." });
      return;
    }

    next(error);
  }
};
