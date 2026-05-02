"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

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
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-[15px] text-foreground">
          AskTheMenu
        </span>
        <span className="truncate text-muted-foreground text-xs">
          {tableLabel || "Restaurant table"}
        </span>
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
