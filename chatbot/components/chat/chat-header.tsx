"use client";

import Link from "next/link";
import { memo } from "react";
import type { VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType: _selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const tableLabel = chatId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
