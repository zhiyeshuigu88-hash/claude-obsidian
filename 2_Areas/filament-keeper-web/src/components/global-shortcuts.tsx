"use client";

import { useEffect } from "react";
import { useAppDialogs } from "@/components/providers/app-dialogs-provider";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function GlobalShortcuts() {
  const { openFilamentDialog, openPrintJobDialog } = useAppDialogs();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openPrintJobDialog();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        openFilamentDialog();
        return;
      }
      if (e.key === "/") {
        const el = document.getElementById("filament-search");
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openFilamentDialog, openPrintJobDialog]);

  return null;
}

export function submitOnCtrlEnter(e: React.KeyboardEvent<HTMLFormElement>) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    e.currentTarget.requestSubmit();
  }
}
