import { NextResponse } from "next/server";
import { z } from "zod";
import { type CreateOrderInput, createOrder } from "@/lib/db/order-queries";
import { ChatbotError } from "@/lib/errors";

const createOrderSchema = z.object({
  tableSlug: z.string().min(1).max(120),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        quantity: z.number().int().min(1).max(50),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(20),
  customerNote: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input: CreateOrderInput = createOrderSchema.parse(json);

    const result = await createOrder(input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid order data", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    console.error("Order creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
