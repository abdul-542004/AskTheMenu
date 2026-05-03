import { NextResponse } from "next/server";
import { z } from "zod";
import { updateOrderStatus } from "@/lib/db/order-queries";
import { ChatbotError } from "@/lib/errors";

const updateStatusSchema = z.object({
  status: z.enum(["accepted", "preparing", "served", "cancelled"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const json = await request.json();
    const { status } = updateStatusSchema.parse(json);

    const updated = await updateOrderStatus(id, status);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid status", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    console.error("Order status update failed:", error);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
