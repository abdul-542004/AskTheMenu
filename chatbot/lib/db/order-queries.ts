import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatbotError } from "../errors";
import {
  menuItem,
  type Order,
  order,
  orderItem,
  restaurant,
  restaurantTable,
} from "./schema";
import { getDatabaseUrl, isSupabasePoolerUrl } from "./url";

// ── Database Connection ─────────────────────────────────────────────────────

let __db: ReturnType<typeof drizzle> | undefined;
function initDb() {
  if (__db) {
    return __db;
  }

  const databaseUrl = getDatabaseUrl();
  const isSupabasePooler = isSupabasePoolerUrl(databaseUrl);

  const client = postgres(
    databaseUrl || "postgres://postgres:postgres@127.0.0.1:65432/postgres",
    {
      connect_timeout: 1,
      prepare: databaseUrl ? !isSupabasePooler : false,
    }
  );

  __db = drizzle(client);
  return __db;
}

const db = new Proxy(
  {},
  {
    get(_, prop) {
      const real = initDb();
      return (real as any)[prop];
    },
    apply(_, thisArg, args) {
      const real = initDb();
      return (real as any).apply(thisArg, args);
    },
  }
) as unknown as ReturnType<typeof drizzle>;

// ── Types ───────────────────────────────────────────────────────────────────

export type OrderItemInput = {
  name: string;
  quantity: number;
  notes?: string;
};

export type CreateOrderInput = {
  tableSlug: string;
  items: OrderItemInput[];
  customerNote?: string;
};

export type CreateOrderResult = {
  orderId: string;
  tableLabel: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPricePkr: number;
    lineTotalPkr: number;
    notes: string | null;
  }>;
  subtotalPkr: number;
  gstRatePct: number;
  gstAmountPkr: number;
  totalPkr: number;
  customerNote: string | null;
  status: string;
};

// ── Resolve Table Slug ──────────────────────────────────────────────────────

async function resolveTableSlug(tableSlug: string) {
  const [table] = await db
    .select({
      id: restaurantTable.id,
      restaurantId: restaurantTable.restaurantId,
      label: restaurantTable.label,
    })
    .from(restaurantTable)
    .where(
      and(
        eq(restaurantTable.qrSlug, tableSlug),
        eq(restaurantTable.isActive, true)
      )
    )
    .limit(1);

  if (!table) {
    throw new ChatbotError(
      "not_found:database",
      `Table "${tableSlug}" not found`
    );
  }

  return table;
}

// ── Resolve Menu Items by Name ──────────────────────────────────────────────

async function resolveMenuItemsByName(
  names: string[],
  restaurantId: string
): Promise<
  Map<string, { id: string; name: string; pricePkr: number; unitLabel: string }>
> {
  // Fetch all available menu items for this restaurant
  const items = await db
    .select({
      id: menuItem.id,
      name: menuItem.name,
      pricePkr: menuItem.pricePkr,
      unitLabel: menuItem.unitLabel,
    })
    .from(menuItem)
    .where(
      and(
        eq(menuItem.restaurantId, restaurantId),
        eq(menuItem.isAvailable, true)
      )
    );

  // Build a case-insensitive lookup map
  const byLowerName = new Map(
    items.map((item) => [item.name.toLowerCase(), item])
  );

  const result = new Map<
    string,
    { id: string; name: string; pricePkr: number; unitLabel: string }
  >();
  const missing: string[] = [];

  for (const name of names) {
    const found = byLowerName.get(name.toLowerCase());
    if (found) {
      result.set(name.toLowerCase(), found);
    } else {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new ChatbotError(
      "bad_request:database",
      `Menu items not found: ${missing.join(", ")}. Please check the names and try again.`
    );
  }

  return result;
}

// ── Get Restaurant GST Rate ─────────────────────────────────────────────────

async function getRestaurantGstRate(
  restaurantId: string
): Promise<{ gstRateBps: number; gstRatePct: number }> {
  const [rest] = await db
    .select({ gstRateBps: restaurant.gstRateBps })
    .from(restaurant)
    .where(eq(restaurant.id, restaurantId))
    .limit(1);

  const gstRateBps = rest?.gstRateBps ?? 1600;
  return {
    gstRateBps,
    gstRatePct: gstRateBps / 100, // 1600 bps → 16%
  };
}

// ── Create Order ────────────────────────────────────────────────────────────

export async function createOrder(
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  const table = await resolveTableSlug(input.tableSlug);
  const { gstRateBps, gstRatePct } = await getRestaurantGstRate(
    table.restaurantId
  );

  // Resolve all item names to DB records
  const uniqueNames = [...new Set(input.items.map((i) => i.name))];
  const menuItemMap = await resolveMenuItemsByName(
    uniqueNames,
    table.restaurantId
  );

  // Build order items with prices
  const resolvedItems = input.items.map((item) => {
    const dbItem = menuItemMap.get(item.name.toLowerCase());
    if (!dbItem) {
      throw new ChatbotError(
        "bad_request:database",
        `Menu item "${item.name}" not found`
      );
    }
    return {
      menuItemId: dbItem.id,
      name: dbItem.name,
      quantity: item.quantity,
      unitPricePkr: dbItem.pricePkr,
      lineTotalPkr: dbItem.pricePkr * item.quantity,
      notes: item.notes ?? null,
    };
  });

  // Calculate totals deterministically
  const subtotalPkr = resolvedItems.reduce(
    (sum, item) => sum + item.lineTotalPkr,
    0
  );
  const gstAmountPkr = Math.round((subtotalPkr * gstRateBps) / 10_000);
  const totalPkr = subtotalPkr + gstAmountPkr;

  // Insert the order
  const [newOrder] = await db
    .insert(order)
    .values({
      restaurantId: table.restaurantId,
      tableId: table.id,
      status: "pending",
      subtotalPkr,
      gstAmountPkr,
      totalPkr,
      customerNote: input.customerNote ?? null,
    })
    .returning();

  // Insert order items
  for (const item of resolvedItems) {
    await db.insert(orderItem).values({
      orderId: newOrder.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPricePkr: item.unitPricePkr,
      notes: item.notes,
    });
  }

  return {
    orderId: newOrder.id,
    tableLabel: table.label,
    items: resolvedItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPricePkr: item.unitPricePkr,
      lineTotalPkr: item.lineTotalPkr,
      notes: item.notes,
    })),
    subtotalPkr,
    gstRatePct,
    gstAmountPkr,
    totalPkr,
    customerNote: input.customerNote ?? null,
    status: "pending",
  };
}

// ── Update Order Status ─────────────────────────────────────────────────────

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["served", "cancelled"],
  served: [],
  cancelled: [],
};

export async function updateOrderStatus(
  orderId: string,
  newStatus: "accepted" | "preparing" | "served" | "cancelled"
): Promise<Order> {
  const [existing] = await db
    .select()
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!existing) {
    throw new ChatbotError(
      "not_found:database",
      `Order "${orderId}" not found`
    );
  }

  const allowed = VALID_STATUS_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new ChatbotError(
      "bad_request:database",
      `Cannot change order from "${existing.status}" to "${newStatus}"`
    );
  }

  const [updated] = await db
    .update(order)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(order.id, orderId))
    .returning();

  return updated;
}

// ── Get Orders by Table Slug ────────────────────────────────────────────────

export async function getOrdersByTableSlug(tableSlug: string) {
  const table = await resolveTableSlug(tableSlug);

  return await db
    .select()
    .from(order)
    .where(eq(order.tableId, table.id))
    .orderBy(desc(order.createdAt));
}
