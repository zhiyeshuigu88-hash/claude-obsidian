"use client";

import { Button } from "@/components/ui/button";
import { Plus, Printer } from "lucide-react";
import { useAppDialogs } from "@/components/providers/app-dialogs-provider";

export function QuickActions() {
  const { openFilamentDialog, openPrintJobDialog } = useAppDialogs();
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={openPrintJobDialog}>
        <Printer className="size-4" />
        印刷を記録する
        <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-xs">N</kbd>
      </Button>
      <Button variant="outline" onClick={openFilamentDialog}>
        <Plus className="size-4" />
        フィラメントを追加する
        <kbd className="ml-1 rounded bg-muted px-1 text-xs">F</kbd>
      </Button>
    </div>
  );
}
