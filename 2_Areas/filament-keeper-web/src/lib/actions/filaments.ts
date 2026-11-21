"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { filaments } from "@/lib/db/schema";

const filamentSchema = z.object({
  profileId: z.coerce.number().int().positive(),
  colorName: z.string().min(1, "色名を入力してください"),
  colorHex: z.string().min(1, "カラーコードを選択してください"),
  nominalWeightG: z.coerce.number().int().positive(),
  registeredWeightG: z.coerce.number().int().nonnegative(),
  priceYen: z.coerce.number().int().nonnegative(),
  purchasedAt: z.string().optional().or(z.literal("")),
  purchasedFrom: z.string().optional(),
  openedAt: z.string().optional().or(z.literal("")),
  note: z.string().optional(),
});

export type FilamentInput = z.infer<typeof filamentSchema>;

function emptyToNull(v?: string) {
  return v && v.length > 0 ? v : null;
}

export async function createFilament(input: FilamentInput) {
  const data = filamentSchema.parse(input);
  const now = new Date().toISOString();
  const openedAt = emptyToNull(data.openedAt);

  const [row] = await db
    .insert(filaments)
    .values({
      profileId: data.profileId,
      colorName: data.colorName,
      colorHex: data.colorHex,
      nominalWeightG: data.nominalWeightG,
      registeredWeightG: data.registeredWeightG,
      currentWeightG: data.registeredWeightG,
      priceYen: data.priceYen,
      purchasedAt: emptyToNull(data.purchasedAt),
      purchasedFrom: data.purchasedFrom || null,
      openedAt,
      status: openedAt ? "in_use" : "unopened",
      note: data.note || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  revalidatePath("/filaments");
  revalidatePath("/");
  return row;
}

export async function updateFilament(id: number, input: FilamentInput) {
  const data = filamentSchema.parse(input);
  const now = new Date().toISOString();
  const openedAt = emptyToNull(data.openedAt);

  const existing = (await db.select().from(filaments).where(eq(filaments.id, id)))[0];
  if (!existing) throw new Error("フィラメントが見つかりません");

  const status = existing.status === "used_up" ? "used_up" : openedAt ? "in_use" : "unopened";

  const [row] = await db
    .update(filaments)
    .set({
      profileId: data.profileId,
      colorName: data.colorName,
      colorHex: data.colorHex,
      nominalWeightG: data.nominalWeightG,
      registeredWeightG: data.registeredWeightG,
      priceYen: data.priceYen,
      purchasedAt: emptyToNull(data.purchasedAt),
      purchasedFrom: data.purchasedFrom || null,
      openedAt,
      status,
      note: data.note || null,
      updatedAt: now,
    })
    .where(eq(filaments.id, id))
    .returning();

  revalidatePath("/filaments");
  revalidatePath(`/filaments/${id}`);
  revalidatePath("/");
  return row;
}

export async function softDeleteFilament(id: number) {
  const now = new Date().toISOString();
  await db.update(filaments).set({ deletedAt: now, updatedAt: now }).where(eq(filaments.id, id));
  revalidatePath("/filaments");
  revalidatePath("/");
}

export async function markUsedUp(id: number) {
  const now = new Date().toISOString();
  await db
    .update(filaments)
    .set({ status: "used_up", updatedAt: now })
    .where(eq(filaments.id, id));
  revalidatePath("/filaments");
  revalidatePath(`/filaments/${id}`);
  revalidatePath("/");
}

export async function duplicateFilament(id: number) {
  const existing = (await db.select().from(filaments).where(eq(filaments.id, id)))[0];
  if (!existing) throw new Error("フィラメントが見つかりません");

  const now = new Date().toISOString();
  const [row] = await db
    .insert(filaments)
    .values({
      profileId: existing.profileId,
      colorName: existing.colorName,
      colorHex: existing.colorHex,
      nominalWeightG: existing.nominalWeightG,
      registeredWeightG: existing.nominalWeightG,
      currentWeightG: existing.nominalWeightG,
      priceYen: existing.priceYen,
      purchasedFrom: existing.purchasedFrom,
      status: "unopened",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  revalidatePath("/filaments");
  revalidatePath("/");
  return row;
}

export async function overrideSpoolWeight(profileId: number, spoolWeightG: number) {
  const { filamentProfiles } = await import("@/lib/db/schema");
  const now = new Date().toISOString();
  await db
    .update(filamentProfiles)
    .set({ spoolWeightG, updatedAt: now })
    .where(eq(filamentProfiles.id, profileId));
  revalidatePath("/profiles");
  revalidatePath("/filaments");
}
