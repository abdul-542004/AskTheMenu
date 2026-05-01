import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..");
const menuPath = join(appDir, "data", "menu.json");

config({ path: join(appDir, ".env.local") });
config({ path: join(appDir, ".env") });

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.SUPABASE_DB_URL ??
  process.env.SUPABASE_DATABASE_URL;

const shouldCreateSampleOrder = process.argv.includes("--sample-order");
const restaurantName = "AskTheMenu Demo Restaurant";
const tableSlugs = ["table-1", "table-2", "table-3", "table-4", "table-5"];

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

function mapCuisineType(cuisineType) {
  return cuisineType === "staple" ? "other" : cuisineType;
}

function tableLabelFromSlug(slug) {
  return slug.replace("table-", "");
}

async function getOrCreateRestaurant() {
  const existing = await sql`
    SELECT * FROM "Restaurant"
    WHERE "name" = ${restaurantName}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;

  if (existing[0]) {
    return existing[0];
  }

  const inserted = await sql`
    INSERT INTO "Restaurant" ("name")
    VALUES (${restaurantName})
    RETURNING *
  `;

  return inserted[0];
}

async function seedTables(restaurantId) {
  for (const slug of tableSlugs) {
    await sql`
      INSERT INTO "RestaurantTable" ("restaurantId", "label", "qrSlug")
      VALUES (${restaurantId}, ${tableLabelFromSlug(slug)}, ${slug})
      ON CONFLICT ("qrSlug") DO UPDATE SET
        "restaurantId" = EXCLUDED."restaurantId",
        "label" = EXCLUDED."label",
        "isActive" = true,
        "updatedAt" = now()
    `;
  }
}

async function seedMenuItems(restaurantId, menuItems) {
  for (const item of menuItems) {
    await sql`
      INSERT INTO "MenuItem" (
        "restaurantId",
        "name",
        "ingredients",
        "allergens",
        "dietary",
        "spiceLevel",
        "cuisineType",
        "specialty",
        "pairings",
        "pricePkr",
        "unitLabel",
        "serving",
        "isAvailable"
      )
      VALUES (
        ${restaurantId},
        ${item.name},
        ${item.ingredients},
        ${item.allergens},
        ${item.dietary},
        ${item.spiceLevel},
        ${mapCuisineType(item.cuisineType)},
        ${item.specialty},
        ${item.pairings},
        ${item.price.amount},
        ${item.price.unit},
        ${item.serving},
        true
      )
      ON CONFLICT ("restaurantId", "name") DO UPDATE SET
        "ingredients" = EXCLUDED."ingredients",
        "allergens" = EXCLUDED."allergens",
        "dietary" = EXCLUDED."dietary",
        "spiceLevel" = EXCLUDED."spiceLevel",
        "cuisineType" = EXCLUDED."cuisineType",
        "specialty" = EXCLUDED."specialty",
        "pairings" = EXCLUDED."pairings",
        "pricePkr" = EXCLUDED."pricePkr",
        "unitLabel" = EXCLUDED."unitLabel",
        "serving" = EXCLUDED."serving",
        "isAvailable" = true,
        "updatedAt" = now()
    `;
  }
}

async function createSampleOrder(restaurantId) {
  const tables = await sql`
    SELECT * FROM "RestaurantTable"
    WHERE "restaurantId" = ${restaurantId} AND "qrSlug" = 'table-1'
    LIMIT 1
  `;
  const table = tables[0];

  const menuItems = await sql`
    SELECT * FROM "MenuItem"
    WHERE "restaurantId" = ${restaurantId}
      AND "name" IN ('Chicken Biryani', 'Garlic Naan', 'Mint Margarita')
    ORDER BY "name" ASC
  `;

  if (!table || menuItems.length === 0) {
    throw new Error(
      "Could not create sample order: missing table or menu items."
    );
  }

  const quantitiesByName = new Map([
    ["Chicken Biryani", 2],
    ["Garlic Naan", 2],
    ["Mint Margarita", 2],
  ]);

  const subtotal = menuItems.reduce(
    (total, item) =>
      total + item.pricePkr * (quantitiesByName.get(item.name) ?? 1),
    0
  );
  const gstAmount = Math.round(subtotal * 0.16);
  const total = subtotal + gstAmount;

  const orders = await sql`
    INSERT INTO "Order" (
      "restaurantId",
      "tableId",
      "status",
      "subtotalPkr",
      "gstAmountPkr",
      "totalPkr",
      "customerNote"
    )
    VALUES (
      ${restaurantId},
      ${table.id},
      'pending',
      ${subtotal},
      ${gstAmount},
      ${total},
      'Demo order seeded for kitchen verification.'
    )
    RETURNING *
  `;
  const order = orders[0];

  for (const item of menuItems) {
    await sql`
      INSERT INTO "OrderItem" ("orderId", "menuItemId", "quantity", "unitPricePkr")
      VALUES (
        ${order.id},
        ${item.id},
        ${quantitiesByName.get(item.name) ?? 1},
        ${item.pricePkr}
      )
    `;
  }
}

async function main() {
  const menuItems = JSON.parse(readFileSync(menuPath, "utf8"));

  if (menuItems.length !== 100) {
    throw new Error(`Expected 100 menu items, found ${menuItems.length}.`);
  }

  const restaurant = await getOrCreateRestaurant();

  await seedTables(restaurant.id);
  await seedMenuItems(restaurant.id, menuItems);

  if (shouldCreateSampleOrder) {
    await createSampleOrder(restaurant.id);
  }

  console.log(`Seeded restaurant: ${restaurant.name}`);
  console.log(`Seeded tables: ${tableSlugs.length}`);
  console.log(`Seeded menu items: ${menuItems.length}`);
  console.log(
    shouldCreateSampleOrder
      ? "Seeded sample kitchen order: yes"
      : "Seeded sample kitchen order: no"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
