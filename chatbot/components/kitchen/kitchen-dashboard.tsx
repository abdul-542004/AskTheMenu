"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import type { KitchenOrder } from "@/lib/db/queries";
import { OrderCard } from "./order-card";

type FilterTab = "all" | "active" | "completed";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All Orders" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

const ACTIVE_STATUSES = new Set(["pending", "accepted", "preparing"]);
const COMPLETED_STATUSES = new Set(["served", "cancelled"]);

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error("Failed to fetch");
    }
    return res.json();
  });

export function KitchenDashboard({
  initialOrders,
}: {
  initialOrders: KitchenOrder[];
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("active");

  const { data, mutate } = useSWR<{ orders: KitchenOrder[] }>(
    "/api/orders/kitchen",
    fetcher,
    {
      refreshInterval: 5000,
      fallbackData: { orders: initialOrders },
      revalidateOnFocus: true,
    }
  );

  const orders = data?.orders ?? initialOrders;

  // Filter orders based on the active tab
  const filteredOrders = orders.filter((order) => {
    if (activeTab === "active") {
      return ACTIVE_STATUSES.has(order.status);
    }
    if (activeTab === "completed") {
      return COMPLETED_STATUSES.has(order.status);
    }
    return true;
  });

  // Count badges
  const activeCount = orders.filter((o) =>
    ACTIVE_STATUSES.has(o.status)
  ).length;
  const completedCount = orders.filter((o) =>
    COMPLETED_STATUSES.has(o.status)
  ).length;
  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const countByTab: Record<FilterTab, number> = {
    all: orders.length,
    active: activeCount,
    completed: completedCount,
  };

  // Handle status change with optimistic update
  const handleStatusChange = useCallback(
    async (orderId: string, newStatus: string) => {
      // Optimistic update
      mutate(
        (current) => {
          if (!current) {
            return current;
          }
          return {
            orders: current.orders.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    status: newStatus as KitchenOrder["status"],
                    updatedAt: new Date(),
                  }
                : o
            ),
          };
        },
        { revalidate: false }
      );

      try {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          throw new Error("Failed to update status");
        }

        // Revalidate to get fresh data
        mutate();
      } catch {
        // Revert on error
        mutate();
      }
    },
    [mutate]
  );

  // Flash notification for new pending orders
  const [prevPendingCount, setPrevPendingCount] = useState(pendingCount);
  useEffect(() => {
    if (pendingCount > prevPendingCount && prevPendingCount >= 0) {
      // Could add audio notification here
      document.title = `(${pendingCount}) New Orders | Kitchen`;
    } else {
      document.title =
        pendingCount > 0
          ? `(${pendingCount}) Kitchen Dashboard`
          : "Kitchen Dashboard";
    }
    setPrevPendingCount(pendingCount);
  }, [pendingCount, prevPendingCount]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M15 11h.01M11 15h.01M16 16c1 0 2-1 2-3s-2-5-2-5-2 3-2 5 1 3 2 3Z" />
                  <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                </svg>
              </div>
              <div>
                <h1 className="font-bold text-2xl tracking-tight">
                  Kitchen Dashboard
                </h1>
                <p className="text-muted-foreground text-sm">
                  Live orders · auto-refreshes every 5s
                </p>
              </div>
            </div>
          </div>

          {/* Pending count badge */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              {pendingCount} pending
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="mt-4 flex gap-1 rounded-lg bg-muted/50 p-1">
          {FILTER_TABS.map((tab) => (
            <button
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums ${
                  activeTab === tab.key
                    ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {countByTab[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <section className="flex flex-1 items-center justify-center">
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <svg
                className="h-6 w-6 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z" />
                <path d="M6 9.01V9" />
                <path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19" />
              </svg>
            </div>
            <h2 className="font-medium text-base">
              {activeTab === "active"
                ? "No active orders"
                : activeTab === "completed"
                  ? "No completed orders"
                  : "No orders yet"}
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              {activeTab === "active"
                ? "New orders from diners will appear here."
                : activeTab === "completed"
                  ? "Served and cancelled orders will appear here."
                  : "Orders placed through the chatbot will appear here."}
            </p>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              onStatusChange={handleStatusChange}
              order={order}
            />
          ))}
        </div>
      )}
    </div>
  );
}
