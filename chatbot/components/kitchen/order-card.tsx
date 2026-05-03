"use client";

import { useState } from "react";
import type { KitchenOrder } from "@/lib/db/queries";

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  KitchenOrder["status"],
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    dotColor: string;
  }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    borderColor: "border-amber-200 dark:border-amber-800/60",
    dotColor: "bg-amber-500",
  },
  accepted: {
    label: "Accepted",
    color: "text-sky-700 dark:text-sky-300",
    bgColor: "bg-sky-50 dark:bg-sky-950/40",
    borderColor: "border-sky-200 dark:border-sky-800/60",
    dotColor: "bg-sky-500",
  },
  preparing: {
    label: "Preparing",
    color: "text-indigo-700 dark:text-indigo-300",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/40",
    borderColor: "border-indigo-200 dark:border-indigo-800/60",
    dotColor: "bg-indigo-500",
  },
  served: {
    label: "Served",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    borderColor: "border-emerald-200 dark:border-emerald-800/60",
    dotColor: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-zinc-500 dark:text-zinc-400",
    bgColor: "bg-zinc-50 dark:bg-zinc-900/60",
    borderColor: "border-zinc-200 dark:border-zinc-800",
    dotColor: "bg-zinc-400",
  },
};

const NEXT_ACTION: Record<
  string,
  { nextStatus: string; label: string; className: string } | null
> = {
  pending: {
    nextStatus: "accepted",
    label: "Accept",
    className:
      "bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-600",
  },
  accepted: {
    nextStatus: "preparing",
    label: "Start Preparing",
    className:
      "bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600",
  },
  preparing: {
    nextStatus: "served",
    label: "Mark Served",
    className:
      "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600",
  },
  served: null,
  cancelled: null,
};

// ── Currency / Date Formatters ──────────────────────────────────────────────

function formatCurrency(value: number) {
  return `PKR ${value.toLocaleString("en-PK")}`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86_400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return formatDate(date);
}

// ── Component ───────────────────────────────────────────────────────────────

type OrderCardProps = {
  order: KitchenOrder;
  onStatusChange: (orderId: string, newStatus: string) => Promise<void>;
};

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const statusConfig = STATUS_CONFIG[order.status];
  const nextAction = NEXT_ACTION[order.status];
  const canCancel =
    order.status === "pending" ||
    order.status === "accepted" ||
    order.status === "preparing";

  async function handleStatusChange(newStatus: string) {
    setIsUpdating(true);
    try {
      await onStatusChange(order.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <article
      className={`group relative rounded-xl border ${statusConfig.borderColor} bg-card shadow-sm transition-all duration-200 hover:shadow-md`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Table Badge */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 font-semibold text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            {order.tableLabel}
          </div>
          <div>
            <h3 className="font-semibold text-base leading-tight">
              Table {order.tableLabel}
            </h3>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {timeAgo(order.createdAt)} · {formatTime(order.createdAt)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusConfig.borderColor} ${statusConfig.bgColor} ${statusConfig.color}`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${statusConfig.dotColor} ${
              order.status === "preparing" ? "animate-pulse" : ""
            }`}
          />
          {statusConfig.label}
        </div>
      </div>

      {/* Customer Note */}
      {order.customerNote && (
        <div className="mx-4 mb-3 rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-sm leading-relaxed">
            <span className="font-medium text-muted-foreground">Note: </span>
            {order.customerNote}
          </p>
        </div>
      )}

      {/* Items List */}
      <div className="mx-4 mb-3 divide-y divide-border/50 rounded-lg border border-border/50">
        {order.items.length > 0 ? (
          order.items.map((item) => (
            <div
              className="flex items-center gap-3 px-3 py-2.5 text-sm"
              key={item.id}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 font-semibold text-xs tabular-nums dark:bg-zinc-800">
                {item.quantity}×
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.menuItemName}</p>
                {item.notes && (
                  <p className="mt-0.5 truncate text-muted-foreground text-xs">
                    {item.notes}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                {formatCurrency(item.unitPricePkr * item.quantity)}
              </span>
            </div>
          ))
        ) : (
          <p className="px-3 py-2.5 text-muted-foreground text-sm">
            No items attached
          </p>
        )}
      </div>

      {/* Totals */}
      <div className="mx-4 mb-4 flex items-end justify-between gap-4 text-sm">
        <div className="flex gap-4 text-muted-foreground text-xs">
          <span>Sub: {formatCurrency(order.subtotalPkr)}</span>
          <span>GST: {formatCurrency(order.gstAmountPkr)}</span>
        </div>
        <p className="font-bold text-base tabular-nums">
          {formatCurrency(order.totalPkr)}
        </p>
      </div>

      {/* Action Buttons */}
      {(nextAction || canCancel) && (
        <div className="flex items-center gap-2 border-t border-border/50 px-4 py-3">
          {nextAction && (
            <button
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${nextAction.className}`}
              disabled={isUpdating}
              onClick={() => handleStatusChange(nextAction.nextStatus)}
              type="button"
            >
              {isUpdating ? "Updating…" : nextAction.label}
            </button>
          )}
          {canCancel && (
            <button
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isUpdating}
              onClick={() => handleStatusChange("cancelled")}
              type="button"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </article>
  );
}
