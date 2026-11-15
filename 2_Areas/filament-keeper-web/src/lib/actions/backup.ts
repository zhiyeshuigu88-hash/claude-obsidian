"use server";

import { revalidatePath } from "next/cache";
import { createBackup } from "@/lib/db/backup";

export async function runBackupNow() {
  const path = createBackup();
  revalidatePath("/settings");
  return path;
}
