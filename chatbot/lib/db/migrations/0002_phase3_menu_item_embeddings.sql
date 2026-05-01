CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "MenuItemEmbedding" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurantId" uuid NOT NULL REFERENCES "Restaurant"("id") ON DELETE cascade,
  "menuItemId" uuid NOT NULL REFERENCES "MenuItem"("id") ON DELETE cascade,
  "model" text NOT NULL,
  "sourceText" text NOT NULL,
  "embedding" vector(3072) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "MenuItemEmbedding_item_model_uq" ON "MenuItemEmbedding" ("menuItemId", "model");
CREATE INDEX IF NOT EXISTS "MenuItemEmbedding_restaurant_idx" ON "MenuItemEmbedding" ("restaurantId");
CREATE INDEX IF NOT EXISTS "MenuItemEmbedding_menuItem_idx" ON "MenuItemEmbedding" ("menuItemId");
