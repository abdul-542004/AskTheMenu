import { getKitchenOrders, type KitchenOrder } from "@/lib/db/queries";
import { hasDatabaseUrl } from "@/lib/db/url";

const currencyFormatter = new Intl.NumberFormat("en-PK", {
  currency: "PKR",
  maximumFractionDigits: 0,
  style: "currency",
});

const statusClasses: Record<KitchenOrder["status"], string> = {
  pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  accepted:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
  preparing:
    "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200",
  served:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  cancelled:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300",
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace("PKR", "PKR ");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

async function getKitchenPageState() {
  if (!hasDatabaseUrl()) {
    return {
      error: null,
      isDatabaseConfigured: false,
      orders: [],
    };
  }

  try {
    return {
      error: null,
      isDatabaseConfigured: true,
      orders: await getKitchenOrders(),
    };
  } catch (_error) {
    return {
      error: "Kitchen orders could not be loaded from Supabase.",
      isDatabaseConfigured: true,
      orders: [],
    };
  }
}

export default async function KitchenPage() {
  const { error, isDatabaseConfigured, orders } = await getKitchenPageState();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Kitchen Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Incoming table orders from Supabase.
          </p>
        </div>
        <div className="rounded-md border border-border px-3 py-2 text-sm">
          {orders.length} {orders.length === 1 ? "order" : "orders"}
        </div>
      </header>

      {isDatabaseConfigured ? (
        error ? (
          <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
            <h2 className="font-medium text-base">Unable to load orders</h2>
            <p className="mt-2 text-muted-foreground text-sm">{error}</p>
          </section>
        ) : orders.length === 0 ? (
          <section className="rounded-lg border border-dashed border-border p-6">
            <h2 className="font-medium text-base">No orders yet</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              Manually inserted orders will appear here newest first.
            </p>
          </section>
        ) : (
          <div className="grid gap-3">
            {orders.map((order) => (
              <article
                className="rounded-lg border border-border bg-card p-4"
                key={order.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium text-base">
                        Table {order.tableLabel}
                      </h2>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs capitalize ${statusClasses[order.status]}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-base">
                      {formatCurrency(order.totalPkr)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      GST {formatCurrency(order.gstAmountPkr)}
                    </p>
                  </div>
                </div>

                {order.customerNote ? (
                  <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">
                    {order.customerNote}
                  </p>
                ) : null}

                <div className="mt-4 divide-y divide-border rounded-md border border-border">
                  {order.items.length > 0 ? (
                    order.items.map((item) => (
                      <div
                        className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2 text-sm"
                        key={item.id}
                      >
                        <span className="font-medium tabular-nums">
                          {item.quantity}x
                        </span>
                        <div>
                          <p>{item.menuItemName}</p>
                          {item.notes ? (
                            <p className="text-muted-foreground text-xs">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-muted-foreground tabular-nums">
                          {formatCurrency(item.unitPricePkr)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-muted-foreground text-sm">
                      No order items attached.
                    </p>
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-medium">
                      {formatCurrency(order.subtotalPkr)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">GST</dt>
                    <dd className="font-medium">
                      {formatCurrency(order.gstAmountPkr)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-medium">
                      {formatCurrency(order.totalPkr)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )
      ) : (
        <section className="rounded-lg border border-dashed border-border p-6">
          <h2 className="font-medium text-base">Database not configured</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Set DATABASE_URL, POSTGRES_URL, SUPABASE_DB_URL, or
            SUPABASE_DATABASE_URL to view kitchen orders.
          </p>
        </section>
      )}
    </main>
  );
}
