/**
 * Phase 4: Embedding Ingestion Script
 *
 * Reads menu items from Supabase, generates embedding-friendly text documents,
 * calls the Gemini embedding API, and upserts vectors into the MenuItemEmbedding table.
 *
 * Usage:
 *   pnpm db:ingest-embeddings
 *   pnpm db:ingest-embeddings --dry-run   # preview without writing
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import postgres from "postgres";

// ── Config ──────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..");

config({ path: join(appDir, ".env.local") });
config({ path: join(appDir, ".env") });

const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIMENSIONS = 3072;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;
const RESTAURANT_NAME = "AskTheMenu Demo Restaurant";

const isDryRun = process.argv.includes("--dry-run");

const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
  console.error("GOOGLE_API_KEY is required. Set it in .env.local or .env");
  process.exit(1);
}

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "No database URL found. Set DATABASE_URL, POSTGRES_URL, SUPABASE_DB_URL, or SUPABASE_DATABASE_URL."
  );
  process.exit(1);
}

const isSupabasePooler =
  databaseUrl.includes("pooler.supabase.com") ||
  databaseUrl.includes("pgbouncer=true");

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: !isSupabasePooler,
});

const genai = new GoogleGenAI({ apiKey: googleApiKey });

// ── Embedding Text Builder ──────────────────────────────────────────────────

/**
 * Converts a menu item row into embedding-friendly text.
 * Includes all contextual fields to maximise retrieval quality.
 */
function buildEmbeddingText(item) {
  const allergens =
    item.allergens && item.allergens.length > 0
      ? item.allergens.join(", ")
      : "none";

  const ingredients =
    item.ingredients && item.ingredients.length > 0
      ? item.ingredients.join(", ")
      : "not specified";

  const pairings =
    item.pairings && item.pairings.length > 0
      ? item.pairings.join(", ")
      : "none";

  const specialtyLabel = item.specialty ? "yes" : "no";
  const servingLabel = item.serving === "shareable" ? "shareable" : "single";
  const unitLabel = item.unitLabel || "serving";

  // Map DB cuisineType back to human-readable label
  const cuisineLabels = {
    desi: "Desi",
    chinese: "Chinese",
    continental: "Continental",
    fusion: "Fusion",
    other: "Staple / Side / Beverage",
  };
  const cuisineDisplay = cuisineLabels[item.cuisineType] || item.cuisineType;

  // Map DB spiceLevel to human-readable
  const spiceLabels = {
    "non-spicy": "non-spicy / none",
    mild: "mild",
    medium: "medium",
    hot: "hot",
  };
  const spiceDisplay = spiceLabels[item.spiceLevel] || item.spiceLevel;

  return [
    `Dish: ${item.name}`,
    `Cuisine: ${cuisineDisplay}`,
    `Ingredients: ${ingredients}`,
    `Allergens: ${allergens}`,
    `Spice level: ${spiceDisplay}`,
    `Dietary: ${item.dietary}`,
    `Price: PKR ${item.pricePkr}/${unitLabel}`,
    `Serving: ${servingLabel}`,
    `Pairings: ${pairings}`,
    `Specialty: ${specialtyLabel}`,
  ].join("\n");
}

// ── Batch Embedding ─────────────────────────────────────────────────────────

async function generateEmbeddingSingle(text) {
  const response = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
    },
  });

  return response.embeddings[0].values;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Phase 4: Embedding Ingestion");
  console.log(`Model: ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}d)`);
  console.log(`Batch size: ${BATCH_SIZE}, delay: ${BATCH_DELAY_MS}ms`);
  if (isDryRun) {
    console.log("DRY RUN — no database writes");
  }
  console.log("");

  // 1. Get restaurant
  const restaurants = await sql`
    SELECT * FROM "Restaurant"
    WHERE "name" = ${RESTAURANT_NAME}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;

  if (restaurants.length === 0) {
    console.error(
      `Restaurant "${RESTAURANT_NAME}" not found. Run db:seed first.`
    );
    process.exit(1);
  }

  const restaurant = restaurants[0];
  console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);

  // 2. Fetch all menu items
  const menuItems = await sql`
    SELECT * FROM "MenuItem"
    WHERE "restaurantId" = ${restaurant.id}
      AND "isAvailable" = true
    ORDER BY "name" ASC
  `;

  console.log(`Found ${menuItems.length} menu items`);

  if (menuItems.length === 0) {
    console.error("No menu items found. Run db:seed first.");
    process.exit(1);
  }

  // 3. Build embedding texts
  const itemsWithText = menuItems.map((item) => ({
    item,
    text: buildEmbeddingText(item),
  }));

  if (isDryRun) {
    console.log("\n--- Sample embedding texts (first 3) ---\n");
    for (const { item, text } of itemsWithText.slice(0, 3)) {
      console.log(`[${item.name}]`);
      console.log(text);
      console.log("---");
    }
    console.log(
      `\nDry run complete. ${itemsWithText.length} items would be embedded.`
    );
    return;
  }

  // 4. Process in batches
  let totalEmbedded = 0;
  let totalErrors = 0;

  for (let i = 0; i < itemsWithText.length; i += BATCH_SIZE) {
    const batch = itemsWithText.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(itemsWithText.length / BATCH_SIZE);

    console.log(
      `Batch ${batchNum}/${totalBatches}: embedding ${batch.length} items...`
    );

    try {
      // Generate and upsert embeddings individually within the batch
      for (const { item, text } of batch) {
        try {
          const vector = await generateEmbeddingSingle(text);

          if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
            console.error(
              `  ✗ ${item.name}: unexpected vector dimension (got ${vector?.length}, expected ${EMBEDDING_DIMENSIONS})`
            );
            totalErrors++;
            continue;
          }

          // Format vector as PGVector literal: [0.1,0.2,...]
          const vectorLiteral = `[${vector.join(",")}]`;

          await sql`
            INSERT INTO "MenuItemEmbedding" (
              "restaurantId",
              "menuItemId",
              "model",
              "sourceText",
              "embedding"
            )
            VALUES (
              ${restaurant.id},
              ${item.id},
              ${EMBEDDING_MODEL},
              ${text},
              ${vectorLiteral}::vector
            )
            ON CONFLICT ("menuItemId", "model") DO UPDATE SET
              "sourceText" = EXCLUDED."sourceText",
              "embedding" = EXCLUDED."embedding",
              "updatedAt" = now()
          `;

          totalEmbedded++;
        } catch (itemError) {
          console.error(`  ✗ ${item.name}:`, itemError.message || itemError);
          totalErrors++;
        }
      }

      console.log(`  ✓ batch complete (${totalEmbedded} total so far)`);
    } catch (error) {
      console.error(`  ✗ Batch ${batchNum} failed:`, error.message || error);
      totalErrors += batch.length;
    }

    // Rate-limit delay between batches
    if (i + BATCH_SIZE < itemsWithText.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // 5. Summary
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log("Ingestion complete");
  console.log(`  Embedded: ${totalEmbedded}/${menuItems.length}`);
  console.log(`  Errors:   ${totalErrors}`);

  // Verify count in DB
  const countResult = await sql`
    SELECT count(*) AS cnt
    FROM "MenuItemEmbedding"
    WHERE "restaurantId" = ${restaurant.id}
      AND "model" = ${EMBEDDING_MODEL}
  `;
  console.log(`  DB rows:  ${countResult[0].cnt}`);
  console.log("═══════════════════════════════════════");
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
