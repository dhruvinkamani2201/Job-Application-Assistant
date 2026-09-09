import { createClient } from "@supabase/supabase-js";

// This client uses the SERVICE ROLE key and must only ever be imported
// from server-side code (API routes / Server Components). It bypasses
// Row Level Security, which is why every write to the database goes
// through our own API routes instead of directly from the browser.
let cached: ReturnType<typeof createClient> | null = null;

export function supabaseServer() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false }
  });
  return cached;
}

export const RESUME_BUCKET = "resumes";
