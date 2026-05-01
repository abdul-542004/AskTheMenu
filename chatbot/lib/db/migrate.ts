import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { getDatabaseUrl, isSupabasePoolerUrl } from "./url";

config({
  path: ".env.local",
});

const databaseUrl = getDatabaseUrl();
const isSupabasePooler = isSupabasePoolerUrl(databaseUrl);

const runMigrate = async () => {
  if (!databaseUrl) {
    console.log(
      "No database URL found. Set DATABASE_URL, POSTGRES_URL, or SUPABASE_DB_URL, skipping migrations"
    );
    process.exit(0);
  }

  const connection = postgres(databaseUrl, {
    max: 1,
    prepare: !isSupabasePooler,
  });
  const db = drizzle(connection);

  console.log("Running migrations...");

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  const end = Date.now();

  console.log("Migrations completed in", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("Migration failed");
  console.error(err);
  process.exit(1);
});
