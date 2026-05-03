import { tool } from "ai";
import { z } from "zod";
import { createOrder } from "@/lib/db/order-queries";

type PlaceOrderProps = {
  tableSlug: string;
};

export const placeOrder = ({ tableSlug }: PlaceOrderProps) =>
  tool({
    description:
      "Place an order for the current table. Call this tool ONLY after confirming with the diner what they want to order. The order will require diner approval before being sent to the kitchen. Include all items with correct names from the menu and quantities.",
    inputSchema: z.object({
      items: z
        .array(
          z.object({
            name: z
              .string()
              .describe(
                "Exact menu item name as it appears in the menu context"
              ),
            quantity: z
              .number()
              .int()
              .min(1)
              .max(50)
              .describe("Number of this item to order"),
            notes: z
              .string()
              .optional()
              .describe(
                "Special instructions for this item (e.g., 'extra spicy', 'no onions')"
              ),
          })
        )
        .min(1)
        .describe("List of menu items to order"),
      customerNote: z
        .string()
        .optional()
        .describe(
          "General note for the order (e.g., 'birthday celebration', 'food allergy')"
        ),
    }),
    // Require human approval before executing — the diner sees a preview
    // card with items, quantities, and total before confirming
    needsApproval: true,
    execute: async ({ items, customerNote }) => {
      try {
        const result = await createOrder({
          tableSlug,
          items,
          customerNote,
        });

        // Format a clean summary for the LLM to relay to the diner
        const itemLines = result.items
          .map(
            (item) =>
              `- ${item.quantity}x ${item.name} - PKR ${item.unitPricePkr}${item.quantity > 1 ? ` x ${item.quantity} = PKR ${item.lineTotalPkr}` : ""}${item.notes ? ` (${item.notes})` : ""}`
          )
          .join("\n");

        return {
          success: true,
          orderId: result.orderId,
          tableLabel: result.tableLabel,
          summary: `Order placed successfully!\n\n${itemLines}\n\nSubtotal: PKR ${result.subtotalPkr}\nGST (${result.gstRatePct}%): PKR ${result.gstAmountPkr}\nTotal: PKR ${result.totalPkr}`,
          subtotalPkr: result.subtotalPkr,
          gstAmountPkr: result.gstAmountPkr,
          totalPkr: result.totalPkr,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to place order";
        return {
          success: false,
          error: message,
        };
      }
    },
  });
