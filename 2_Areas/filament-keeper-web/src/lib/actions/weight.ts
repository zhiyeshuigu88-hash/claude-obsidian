"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { filamentProfiles, filaments, weightAdjustments } from "@/lib/db/schema";
import { clampWeight } from "@/lib/calc";

const usageSchema = z.object({
  filamentId: z.coerce.number().int().positive(),
  usedWeightG: z.coerce.number().nonnegative(),
  note: z.string().optional(),
});

const measuredSchema = z.object({
  filamentId: z.coerce.number().int().positive(),
  measuredTotalWeightG: z.coerce.number().nonnegative(),
  note: z.string().optional(),
});

export type WeightUpdateResult = {
  newWeightG: number;
  clamped: boolean;
  suggestUsedUp: boolean;
};

export async function adjustWeightUsage(input: z.infer<typeof usageSchema>): Promise<WeightUpdateResult> {
  const data = usageSchema.parse(input);
  const now = new Date().toISOString();

  const result = db.transaction((tx) => {
    const existing = tx.select().from(filaments).where(eq(filaments.id, data.filamentId)).get();
    if (!existing) throw new Error("フィラメントが見つかりません");

    const { value, clamped } = clampWeight(existing.currentWeightG - data.usedWeightG);
    const justOpened = existing.status === "unopened";

    tx.update(filaments)
      .set({
        currentWeightG: value,
        status: justOpened ? "in_use" : existing.status,
        openedAt: justOpened ? (existing.openedAt ?? now.slice(0, 10)) : existing.openedAt,
        updatedAt: now,
      })
      .where(eq(filaments.id, data.filamentId))
      .run();

    tx.insert(weightAdjustments)
      .values({
        filamentId: data.filamentId,
        method: "usage",
        valueG: data.usedWeightG,
        resultingWeightG: value,
        adjustedAt: now,
        note: data.note || null,
      })
      .run();

    return { newWeightG: value, clamped, suggestUsedUp: value === 0 };
  });

  revalidatePath(`/filaments/${data.filamentId}`);
  revalidatePath("/filaments");
  revalidatePath("/");
  return result;
}

export async function adjustWeightMeasured(
  input: z.infer<typeof measuredSchema>,
): Promise<WeightUpdateResult> {
  const data = measuredSchema.parse(input);
  const now = new Date().toISOString();

  const result = db.transaction((tx) => {
    const existing = tx.select().from(filaments).where(eq(filaments.id, data.filamentId)).get();
    if (!existing) throw new Error("フィラメントが見つかりません");
    const profile = tx
      .select()
      .from(filamentProfiles)
      .where(eq(filamentProfiles.id, existing.profileId))
      .get();
    if (!profile) throw new Error("プロファイルが見つかりません");

    const { value, clamped } = clampWeight(data.measuredTotalWeightG - profile.spoolWeightG);
    const justOpened = existing.status === "unopened";

    tx.update(filaments)
      .set({
        currentWeightG: value,
        status: justOpened ? "in_use" : existing.status,
        openedAt: justOpened ? (existing.openedAt ?? now.slice(0, 10)) : existing.openedAt,
        updatedAt: now,
      })
      .where(eq(filaments.id, data.filamentId))
      .run();

    tx.insert(weightAdjustments)
      .values({
        filamentId: data.filamentId,
        method: "measured",
        valueG: data.measuredTotalWeightG,
        resultingWeightG: value,
        adjustedAt: now,
        note: data.note || null,
      })
      .run();

    return { newWeightG: value, clamped, suggestUsedUp: value === 0 };
  });

  revalidatePath(`/filaments/${data.filamentId}`);
  revalidatePath("/filaments");
  revalidatePath("/");
  return result;
}
