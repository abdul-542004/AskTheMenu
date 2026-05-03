import { NextResponse } from "next/server";
import { getKitchenOrders } from "@/lib/db/queries";
import { hasDatabaseUrl } from "@/lib/db/url";

export async function GET() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const orders = await getKitchenOrders();
    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch kitchen orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
