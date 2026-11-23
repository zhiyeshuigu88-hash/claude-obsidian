"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { RegisterFilamentDialog } from "@/components/register-filament-dialog";
import { PrintJobDialog } from "@/components/print-job-dialog";

type AppDialogsContextValue = {
  openFilamentDialog: () => void;
  openPrintJobDialog: () => void;
};

const AppDialogsContext = createContext<AppDialogsContextValue | null>(null);

export function useAppDialogs() {
  const ctx = useContext(AppDialogsContext);
  if (!ctx) throw new Error("useAppDialogs must be used within AppDialogsProvider");
  return ctx;
}

export function AppDialogsProvider({ children }: { children: React.ReactNode }) {
  const [filamentOpen, setFilamentOpen] = useState(false);
  const [printJobOpen, setPrintJobOpen] = useState(false);

  const openFilamentDialog = useCallback(() => setFilamentOpen(true), []);
  const openPrintJobDialog = useCallback(() => setPrintJobOpen(true), []);

  return (
    <AppDialogsContext.Provider value={{ openFilamentDialog, openPrintJobDialog }}>
      {children}
      <RegisterFilamentDialog open={filamentOpen} onOpenChange={setFilamentOpen} />
      <PrintJobDialog open={printJobOpen} onOpenChange={setPrintJobOpen} />
    </AppDialogsContext.Provider>
  );
}
