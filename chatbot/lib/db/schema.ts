import { type InferSelectModel, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const dietaryEnum = pgEnum("dietary", [
  "vegetarian",
  "non-vegetarian",
  "vegan",
]);

export const spiceLevelEnum = pgEnum("spice_level", [
  "non-spicy",
  "mild",
  "medium",
  "hot",
]);

export const cuisineTypeEnum = pgEnum("cuisine_type", [
  "desi",
  "chinese",
  "continental",
  "fusion",
  "other",
]);

export const servingEnum = pgEnum("serving", ["single", "shareable"]);

export const chatSessionStatusEnum = pgEnum("chat_session_status", [
  "active",
  "closed",
]);

export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "system",
  "user",
  "assistant",
  "tool",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "served",
  "cancelled",
]);

export const restaurant = pgTable("Restaurant", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("PKR"),
  gstRateBps: integer("gstRateBps").notNull().default(1600),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Restaurant = InferSelectModel<typeof restaurant>;

export const restaurantTable = pgTable(
  "RestaurantTable",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    restaurantId: uuid("restaurantId")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    qrSlug: varchar("qrSlug", { length: 128 }).notNull(),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    restaurantLabelUnique: uniqueIndex(
      "RestaurantTable_restaurant_label_uq"
    ).on(table.restaurantId, table.label),
    qrSlugUnique: uniqueIndex("RestaurantTable_qrSlug_uq").on(table.qrSlug),
    restaurantLookupIdx: index("RestaurantTable_restaurant_idx").on(
      table.restaurantId
    ),
  })
);

export type RestaurantTable = InferSelectModel<typeof restaurantTable>;

export const menuItem = pgTable(
  "MenuItem",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    restaurantId: uuid("restaurantId")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ingredients: text("ingredients")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    allergens: text("allergens")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    dietary: dietaryEnum("dietary").notNull(),
    spiceLevel: spiceLevelEnum("spiceLevel").notNull(),
    cuisineType: cuisineTypeEnum("cuisineType").notNull(),
    specialty: boolean("specialty").notNull().default(false),
    pairings: text("pairings").array().notNull().default(sql`ARRAY[]::text[]`),
    pricePkr: integer("pricePkr").notNull(),
    unitLabel: text("unitLabel").notNull().default("serving"),
    serving: servingEnum("serving").notNull(),
    isAvailable: boolean("isAvailable").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    restaurantNameUnique: uniqueIndex("MenuItem_restaurant_name_uq").on(
      table.restaurantId,
      table.name
    ),
    restaurantLookupIdx: index("MenuItem_restaurant_idx").on(
      table.restaurantId
    ),
    dietaryLookupIdx: index("MenuItem_dietary_idx").on(table.dietary),
    spiceLookupIdx: index("MenuItem_spice_idx").on(table.spiceLevel),
    cuisineLookupIdx: index("MenuItem_cuisine_idx").on(table.cuisineType),
  })
);

export type MenuItem = InferSelectModel<typeof menuItem>;

export const menuItemEmbedding = pgTable(
  "MenuItemEmbedding",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    restaurantId: uuid("restaurantId")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    menuItemId: uuid("menuItemId")
      .notNull()
      .references(() => menuItem.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    sourceText: text("sourceText").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }).notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    menuItemModelUnique: uniqueIndex("MenuItemEmbedding_item_model_uq").on(
      table.menuItemId,
      table.model
    ),
    restaurantLookupIdx: index("MenuItemEmbedding_restaurant_idx").on(
      table.restaurantId
    ),
    menuItemLookupIdx: index("MenuItemEmbedding_menuItem_idx").on(
      table.menuItemId
    ),
  })
);

export type MenuItemEmbedding = InferSelectModel<typeof menuItemEmbedding>;

export const chatSession = pgTable(
  "ChatSession",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    restaurantId: uuid("restaurantId")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    tableId: uuid("tableId")
      .notNull()
      .references(() => restaurantTable.id, { onDelete: "cascade" }),
    status: chatSessionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tableLookupIdx: index("ChatSession_table_idx").on(table.tableId),
    statusLookupIdx: index("ChatSession_status_idx").on(table.status),
  })
);

export type ChatSession = InferSelectModel<typeof chatSession>;

export const chatSessionMessage = pgTable(
  "ChatSessionMessage",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => chatSession.id, { onDelete: "cascade" }),
    role: chatMessageRoleEnum("role").notNull(),
    content: json("content").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    sessionLookupIdx: index("ChatSessionMessage_session_idx").on(
      table.sessionId
    ),
    createdAtLookupIdx: index("ChatSessionMessage_createdAt_idx").on(
      table.createdAt
    ),
  })
);

export type ChatSessionMessage = InferSelectModel<typeof chatSessionMessage>;

export const order = pgTable(
  "Order",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    restaurantId: uuid("restaurantId")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    tableId: uuid("tableId")
      .notNull()
      .references(() => restaurantTable.id, { onDelete: "restrict" }),
    chatSessionId: uuid("chatSessionId").references(() => chatSession.id, {
      onDelete: "set null",
    }),
    status: orderStatusEnum("status").notNull().default("pending"),
    subtotalPkr: integer("subtotalPkr").notNull().default(0),
    gstAmountPkr: integer("gstAmountPkr").notNull().default(0),
    totalPkr: integer("totalPkr").notNull().default(0),
    customerNote: text("customerNote"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    tableLookupIdx: index("Order_table_idx").on(table.tableId),
    statusLookupIdx: index("Order_status_idx").on(table.status),
    createdAtLookupIdx: index("Order_createdAt_idx").on(table.createdAt),
  })
);

export type Order = InferSelectModel<typeof order>;

export const orderItem = pgTable(
  "OrderItem",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    orderId: uuid("orderId")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    menuItemId: uuid("menuItemId")
      .notNull()
      .references(() => menuItem.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    unitPricePkr: integer("unitPricePkr").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    orderLookupIdx: index("OrderItem_order_idx").on(table.orderId),
    menuItemLookupIdx: index("OrderItem_menuItem_idx").on(table.menuItemId),
  })
);

export type OrderItem = InferSelectModel<typeof orderItem>;
