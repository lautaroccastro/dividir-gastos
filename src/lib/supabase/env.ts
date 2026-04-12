/**
 * Reads Supabase env vars and fails fast with a clear message if missing.
 * Value for `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the **public** client key from
 * Project Settings → API — today often **Publishable** (`sb_publishable_...`);
 * legacy **anon** JWT (`eyJ...`) still works until deprecated. Never use the
 * **secret** / service_role key in the browser or in NEXT_PUBLIC_*.
 */
function stripTrailingComma(s: string): string {
  return s.replace(/,\s*$/, "").trim();
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = stripTrailingComma(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const anonKey = stripTrailingComma(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables en .env.local: ${missing.join(", ")}. ` +
        "Copiá Project URL y la clave pública (Publishable o anon legacy) desde " +
        "Supabase → Project Settings → API. Guardá el archivo y reiniciá con npm run dev.",
    );
  }
  return { url, anonKey };
}
