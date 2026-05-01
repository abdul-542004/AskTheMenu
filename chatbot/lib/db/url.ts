export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DB_URL ??
    process.env.SUPABASE_DATABASE_URL ??
    ""
  );
}

export function hasDatabaseUrl() {
  return getDatabaseUrl().length > 0;
}

export function isSupabasePoolerUrl(databaseUrl: string) {
  return (
    databaseUrl.includes("pooler.supabase.com") ||
    databaseUrl.includes("pgbouncer=true")
  );
}
