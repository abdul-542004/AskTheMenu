DO $$ BEGIN
  CREATE TYPE "dietary" AS ENUM ('vegetarian', 'non-vegetarian', 'vegan');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "spice_level" AS ENUM ('non-spicy', 'mild', 'medium', 'hot');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "cuisine_type" AS ENUM ('desi', 'chinese', 'continental', 'fusion', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "serving" AS ENUM ('single', 'shareable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "chat_session_status" AS ENUM ('active', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "chat_message_role" AS ENUM ('system', 'user', 'assistant', 'tool');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "order_status" AS ENUM ('pending', 'accepted', 'preparing', 'served', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Restaurant" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'PKR',
  "gstRateBps" integer NOT NULL DEFAULT 1600,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "RestaurantTable" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurantId" uuid NOT NULL REFERENCES "Restaurant"("id") ON DELETE cascade,
  "label" text NOT NULL,
  "qrSlug" varchar(128) NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_restaurant_label_uq" ON "RestaurantTable" ("restaurantId", "label");
CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_qrSlug_uq" ON "RestaurantTable" ("qrSlug");
CREATE INDEX IF NOT EXISTS "RestaurantTable_restaurant_idx" ON "RestaurantTable" ("restaurantId");

CREATE TABLE IF NOT EXISTS "MenuItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurantId" uuid NOT NULL REFERENCES "Restaurant"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "ingredients" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "allergens" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "dietary" "dietary" NOT NULL,
  "spiceLevel" "spice_level" NOT NULL,
  "cuisineType" "cuisine_type" NOT NULL,
  "specialty" boolean NOT NULL DEFAULT false,
  "pairings" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "pricePkr" integer NOT NULL,
  "unitLabel" text NOT NULL DEFAULT 'serving',
  "serving" "serving" NOT NULL,
  "isAvailable" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "MenuItem_restaurant_name_uq" ON "MenuItem" ("restaurantId", "name");
CREATE INDEX IF NOT EXISTS "MenuItem_restaurant_idx" ON "MenuItem" ("restaurantId");
CREATE INDEX IF NOT EXISTS "MenuItem_dietary_idx" ON "MenuItem" ("dietary");
CREATE INDEX IF NOT EXISTS "MenuItem_spice_idx" ON "MenuItem" ("spiceLevel");
CREATE INDEX IF NOT EXISTS "MenuItem_cuisine_idx" ON "MenuItem" ("cuisineType");

CREATE TABLE IF NOT EXISTS "ChatSession" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurantId" uuid NOT NULL REFERENCES "Restaurant"("id") ON DELETE cascade,
  "tableId" uuid NOT NULL REFERENCES "RestaurantTable"("id") ON DELETE cascade,
  "status" "chat_session_status" NOT NULL DEFAULT 'active',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ChatSession_table_idx" ON "ChatSession" ("tableId");
CREATE INDEX IF NOT EXISTS "ChatSession_status_idx" ON "ChatSession" ("status");

CREATE TABLE IF NOT EXISTS "ChatSessionMessage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sessionId" uuid NOT NULL REFERENCES "ChatSession"("id") ON DELETE cascade,
  "role" "chat_message_role" NOT NULL,
  "content" json NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ChatSessionMessage_session_idx" ON "ChatSessionMessage" ("sessionId");
CREATE INDEX IF NOT EXISTS "ChatSessionMessage_createdAt_idx" ON "ChatSessionMessage" ("createdAt");

CREATE TABLE IF NOT EXISTS "Order" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurantId" uuid NOT NULL REFERENCES "Restaurant"("id") ON DELETE cascade,
  "tableId" uuid NOT NULL REFERENCES "RestaurantTable"("id") ON DELETE restrict,
  "chatSessionId" uuid REFERENCES "ChatSession"("id") ON DELETE set null,
  "status" "order_status" NOT NULL DEFAULT 'pending',
  "subtotalPkr" integer NOT NULL DEFAULT 0,
  "gstAmountPkr" integer NOT NULL DEFAULT 0,
  "totalPkr" integer NOT NULL DEFAULT 0,
  "customerNote" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "Order_table_idx" ON "Order" ("tableId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order" ("status");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order" ("createdAt");

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "orderId" uuid NOT NULL REFERENCES "Order"("id") ON DELETE cascade,
  "menuItemId" uuid NOT NULL REFERENCES "MenuItem"("id") ON DELETE restrict,
  "quantity" integer NOT NULL DEFAULT 1,
  "unitPricePkr" integer NOT NULL,
  "notes" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "OrderItem_order_idx" ON "OrderItem" ("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_menuItem_idx" ON "OrderItem" ("menuItemId");
