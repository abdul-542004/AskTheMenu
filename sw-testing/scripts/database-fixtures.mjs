// Fixture setup/cleanup only. There is no test-only HTTP endpoint in the app.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(resolve(process.cwd(), "package.json"));
require("dotenv").config({ path: resolve(process.cwd(), ".env.local") });
const postgres = require("postgres");
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ??
  process.env.SUPABASE_DB_URL ?? process.env.SUPABASE_DATABASE_URL;
if (!url) throw new Error("A configured test database is required");
const sql = postgres(url, { max: 1, prepare: !url.includes("pooler.supabase.com"), connect_timeout: 10 });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.operation === "cleanupOrders") {
    if (!/^SWTEST-[0-9a-f-]{36}-$/.test(input.marker)) throw new Error("Invalid cleanup marker");
    const rows = await sql`DELETE FROM "Order" WHERE "customerNote" LIKE ${input.marker + "%"} RETURNING "id"`;
    process.stdout.write(JSON.stringify({ deletedIds: rows.map((row) => row.id) }));
  } else if (input.operation === "seedChat") {
    if (!uuid.test(input.id) || !uuid.test(input.ownerId)) throw new Error("Invalid fixture UUID");
    await sql`INSERT INTO "Chat" ("id", "createdAt", "title", "userId", "visibility")
      VALUES (${input.id}, now(), ${"SWTEST deletion fixture " + input.id}, ${input.ownerId}, 'private')`;
    process.stdout.write(JSON.stringify({ id: input.id }));
  } else {
    throw new Error("Unknown fixture operation");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
