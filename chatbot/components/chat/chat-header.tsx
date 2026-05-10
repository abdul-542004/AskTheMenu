"use client";

import Link from "next/link";
import { memo, useCallback } from "react";
import { startNewTableConversation } from "@/hooks/use-active-chat";
import type { VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  tableSlug,
  selectedVisibilityType: _selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  tableSlug: string | null;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const tableLabel = (tableSlug ?? chatId)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const handleNewConversation = useCallback(() => {
    if (tableSlug) {
      startNewTableConversation(tableSlug);
      // Force a full page reload so the hook picks up the cleared localStorage
      window.location.reload();
    }
  }, [tableSlug]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-border/50 border-b bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex flex-col">
          <span className="truncate font-semibold text-[15px] text-foreground">
            AskTheMenu
          </span>
        </div>
        {tableSlug && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs ring-1 ring-primary/20">
            🍽 {tableLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isReadonly && tableSlug && (
          <button
            className="rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted md:text-sm"
            onClick={handleNewConversation}
            type="button"
          >
            New chat
          </button>
        )}
        <Link
          className="rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted md:text-sm"
          href="/menu"
        >
          View menu
        </Link>
        {!isReadonly && <div className="hidden" />}
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.tableSlug === nextProps.tableSlug &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
