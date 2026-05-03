import { Suspense } from "react";
import { KitchenDashboard } from "@/components/kitchen/kitchen-dashboard";
import { getKitchenOrders } from "@/lib/db/queries";
import { hasDatabaseUrl } from "@/lib/db/url";

export const metadata = {
  title: "Kitchen Dashboard | AskTheMenu",
  description: "Live kitchen order management for AskTheMenu restaurant.",
};

async function getInitialOrders() {
  if (!hasDatabaseUrl()) {
    return { orders: [], error: null, isDatabaseConfigured: false };
  }

  try {
    const orders = await getKitchenOrders();
    return { orders, error: null, isDatabaseConfigured: true };
  } catch (_error) {
    return {
      orders: [],
      error: "Kitchen orders could not be loaded from Supabase.",
      isDatabaseConfigured: true,
    };
  }
}

async function KitchenPageContent() {
  const { orders, error, isDatabaseConfigured } = await getInitialOrders();

  if (!isDatabaseConfigured) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center px-4 py-6">
        <section className="rounded-xl border border-dashed border-border p-8 text-center">
          <h2 className="font-medium text-base">Database not configured</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Set DATABASE_URL, POSTGRES_URL, SUPABASE_DB_URL, or
            SUPABASE_DATABASE_URL to view kitchen orders.
          </p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center px-4 py-6">
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <h2 className="font-medium text-base">Unable to load orders</h2>
          <p className="mt-2 text-muted-foreground text-sm">{error}</p>
        </section>
      </main>
    );
  }

  return <KitchenDashboard initialOrders={orders} />;
}

export default function KitchenPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center px-4 py-6">
          <section className="rounded-xl border border-dashed border-border p-8 text-center">
            <h2 className="font-medium text-base">Loading kitchen orders</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              Fetching the latest orders for the dashboard.
            </p>
          </section>
        </main>
      }
    >
      <KitchenPageContent />
    </Suspense>
  );
}
