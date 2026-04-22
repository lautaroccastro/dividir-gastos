import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getServiceRoleKey } from "@/lib/supabase/service";

/** Bypasses RLS. Use only in trusted server code (e.g. `/share/[token]`). */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  return createClient(url, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
