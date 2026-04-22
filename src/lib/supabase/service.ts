function stripTrailingComma(s: string): string {
  return s.replace(/,\s*$/, "").trim();
}

/** Service role key: server-only, never NEXT_PUBLIC_*. Used for public share page data loads. */
export function getServiceRoleKey(): string {
  const key = stripTrailingComma(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  if (!key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local (Project Settings → API → service_role). " +
        "Solo se usa en el servidor para cargar grupos por enlace público.",
    );
  }
  return key;
}
