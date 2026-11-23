"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { filamentProfiles, filaments, printJobFilaments, printJobs } from "@/lib/db/schema";
import { clampWeight, jobCostYen } from "@/lib/calc";

const lineSchema = z.object({
  filamentId: z.coerce.number().int().positive(),
  usedWeightG: z.coerce.number().positive("使用量を入力してください"),
});

const printJobSchema = z.object({
  modelName: z.string().optional(),
  printedAt: z.string().min(1),
  durationMin: z.coerce.number().int().nonnegative().optional().or(z.nan().transform(() => undefined)),
  result: z.enum(["success", "failure", "aborted"]),
  note: z.string().optional(),
  lines: z.array(lineSchema).min(1, "フィラメントを1つ以上選択してください"),
});

export type PrintJobInput = z.infer<typeof printJobSchema>;

export async function createPrintJob(input: PrintJobInput) {
  const data = printJobSchema.parse(input);
  const now = new Date().toISOString();

  const result = db.transaction((tx) => {
    const job = tx
      .insert(printJobs)
      .values({
        modelName: data.modelName || null,
        printedAt: data.printedAt,
        durationMin: data.durationMin ?? null,
        result: data.result,
        note: data.note || null,
        createdAt: now,
      })
      .returning()
      .get();

    let totalCostYen = 0;
    const clampedFilamentNames: string[] = [];

    for (const line of data.lines) {
      const filament = tx.select().from(filaments).where(eq(filaments.id, line.filamentId)).get();
      if (!filament) throw new Error("フィラメントが見つかりません");
      const profile = tx
        .select()
        .from(filamentProfiles)
        .where(eq(filamentProfiles.id, filament.profileId))
        .get();
      if (!profile) throw new Error("プロファイルが見つかりません");

      const costYen = jobCostYen(line.usedWeightG, filament.priceYen, filament.nominalWeightG);
      totalCostYen += costYen;

      tx.insert(printJobFilaments)
        .values({
          printJobId: job.id,
          filamentId: line.filamentId,
          usedWeightG: line.usedWeightG,
          costYen,
        })
        .run();

      const { value, clamped } = clampWeight(filament.currentWeightG - line.usedWeightG);
      if (clamped) clampedFilamentNames.push(`${profile.manufacturer} ${profile.productName} ${filament.colorName}`);

      const justOpened = filament.status === "unopened";

      tx.update(filaments)
        .set({
          currentWeightG: value,
          status: justOpened ? "in_use" : filament.status,
          openedAt: justOpened ? (filament.openedAt ?? data.printedAt.slice(0, 10)) : filament.openedAt,
          updatedAt: now,
        })
        .where(eq(filaments.id, line.filamentId))
        .run();
    }

    return { job, totalCostYen, clampedFilamentNames };
  });

  revalidatePath("/");
  revalidatePath("/filaments");
  for (const line of data.lines) {
    revalidatePath(`/filaments/${line.filamentId}`);
  }
  return result;
}
