# Phase 6-7: Ordering Flow & Kitchen Dashboard

## Background

Phases 1–5 are complete: the chatbot UI, menu data, Supabase schema (including `Order`/`OrderItem` tables), embeddings + RAG pipeline, and conversational chat all work. Now we need the **ordering loop**: let the chatbot collect an order and place it, and give the kitchen a live dashboard to manage orders.

## Current State Assessment

What's already done:
- ✅ DB schema for `Order`, `OrderItem` with status enum, GST fields, etc.
- ✅ `getKitchenOrders()` query in `queries.ts` (read-only)
- ✅ Static kitchen page at `/kitchen` (renders orders, **no status-update buttons**)
- ✅ Chat API route sends `tableSlug` to the backend
- ✅ RAG + vector search pipeline operational

What's missing for Phase 6 (Ordering):
- **No order-placement tool** — the LLM has no way to create orders
- **No API route** for creating orders from the chatbot
- **No GST calculation** in code (plan says not to rely on LLM for math)
- **System prompt** doesn't mention ordering capabilities
- Menu item lookup by name is needed to resolve user's order items to DB IDs

What's missing for Phase 7 (Kitchen):
- **No status-update controls** (Accept / Preparing / Served / Cancel buttons)
- **No API route** for updating order status
- **No real-time updates** (Supabase Realtime or polling)
- Kitchen page is server-rendered only, needs client interactivity

---

## Proposed Changes

### Phase 6: Ordering Flow

#### [NEW] `app/(chat)/api/orders/route.ts`
REST API for order operations:
- `POST /api/orders` — Create a new order with items, calculate subtotal/GST/total deterministically in code, save to DB. Accepts `{ tableSlug, items: [{ name, quantity, notes? }], customerNote? }`. Resolves menu item names → UUIDs, fetches prices from DB, computes totals with 16% GST (from restaurant `gstRateBps`).
- Returns the created order with computed totals and item details.

#### [NEW] `app/(chat)/api/orders/[id]/status/route.ts`
- `PATCH /api/orders/[id]/status` — Update order status (for kitchen dashboard). Accepts `{ status: "accepted" | "preparing" | "served" | "cancelled" }`.

#### [NEW] `lib/ai/tools/place-order.ts`
AI SDK tool definition for `placeOrder`:
- Schema: `{ items: [{ name: string, quantity: number, notes?: string }], customerNote?: string }`
- When the LLM calls this tool, it hits the `/api/orders` endpoint server-side (or calls the DB directly)
- Returns a confirmation message with the exact order summary and calculated total
- This tool requires **human confirmation** before executing (using AI SDK's tool approval flow)

#### [MODIFY] `app/(chat)/api/chat/route.ts`
- Register the `placeOrder` tool in the `tools` object
- Add it to `experimental_activeTools` so it's available to the model
- Enable tool approval for the ordering tool

#### [MODIFY] `lib/ai/prompts.ts`
- Update `regularPrompt` to tell the LLM it can place orders via the `placeOrder` tool
- Add instructions: collect items + quantities, confirm with user, then call the tool
- Keep the rule: never claim an order is placed until the tool confirms it

#### [NEW] `lib/db/order-queries.ts`
Server-side order creation logic:
- `createOrder({ tableSlug, items, customerNote })` — resolves table slug → table ID, resolves item names → menu item IDs + prices, calculates subtotal/GST/total, inserts Order + OrderItems in a transaction
- `updateOrderStatus({ orderId, status })` — updates order status + `updatedAt`
- `getOrdersByTableSlug({ tableSlug })` — for optional "show my orders" feature

---

### Phase 7: Kitchen Dashboard

#### [MODIFY] `app/kitchen/page.tsx` → Full Redesign
Convert from a static server component to a client-interactive page:
- **Real-time polling** with SWR (fetches `/api/orders/kitchen` every 5 seconds) — simpler than Supabase Realtime for the MVP
- **Status control buttons**: Accept → Preparing → Served, plus Cancel
- **Visual design**: Status-colored cards, animations on new orders, sound notification option
- **Filter tabs**: All / Active (pending+accepted+preparing) / Completed (served+cancelled)
- Auto-sorts by newest first

#### [NEW] `app/(chat)/api/orders/kitchen/route.ts`
- `GET /api/orders/kitchen` — Returns all orders in the `KitchenOrder` format (reuses `getKitchenOrders()`)
- Used by the kitchen dashboard for SWR polling

#### [NEW] `components/kitchen/order-card.tsx`
Client component for a single order card with:
- Status badge, table label, timestamp
- Items list with quantities and prices
- Subtotal / GST / Total breakdown
- Action buttons that call `PATCH /api/orders/[id]/status`
- Optimistic UI updates

#### [NEW] `components/kitchen/kitchen-dashboard.tsx`
Client component wrapping the polling logic:
- SWR hook fetching kitchen orders
- Filter state (all/active/completed)
- Order count badges
- Empty state

---

## Open Questions

> [!IMPORTANT]
> **Tool Approval UX**: The AI SDK supports a tool approval flow where the user must approve before the tool executes. Should we use this for order placement (user sees a preview card and clicks "Confirm Order"), or should we rely on the LLM asking "Should I place this order?" in text and then calling the tool on confirmation?
> 
> I'll implement the **tool approval flow** as it's more reliable — the user gets a structured preview card with items, quantities, and calculated total before confirming.

> [!NOTE]
> **GST Rate**: The schema has `gstRateBps = 1600` (16% in basis points) on the restaurant table. I'll use this for calculation. PKR amounts are stored as integers (no decimals).

---

## Verification Plan

### Automated Tests
1. **Build check**: `pnpm build` must pass
2. **Manual flow test**: 
   - Open `/chat/table-1`
   - Ask for recommendations, then say "I'd like to order the Chicken Karahi and a Garlic Naan"
   - LLM should call `placeOrder` tool → user sees confirmation card
   - Approve → order is saved in DB with correct totals
   - Open `/kitchen` → order appears with correct items and status "pending"
   - Click "Accept" → status updates to "accepted"
   - Click "Preparing" → "Served" → order moves to completed

### Manual Verification
- Verify GST calculation: subtotal × 16% = GST, subtotal + GST = total
- Verify kitchen dashboard auto-refreshes
- Verify multiple orders from different tables stay separate
