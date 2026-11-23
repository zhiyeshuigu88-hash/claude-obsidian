"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { filamentProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const profileSchema = z.object({
  manufacturer: z.string().min(1, "メーカーを入力してください"),
  productName: z.string().min(1, "製品名を入力してください"),
  material: z.string().min(1, "素材を選択してください"),
  diameter: z.coerce.number().positive(),
  spoolWeightG: z.coerce.number().int().nonnegative(),
  note: z.string().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export async function createProfile(input: ProfileInput) {
  const data = profileSchema.parse(input);
  const now = new Date().toISOString();
  const [row] = await db
    .insert(filamentProfiles)
    .values({ ...data, createdAt: now, updatedAt: now })
    .returning();
  revalidatePath("/profiles");
  revalidatePath("/filaments");
  return row;
}

export async function updateProfile(id: number, input: ProfileInput) {
  const data = profileSchema.parse(input);
  const now = new Date().toISOString();
  const [row] = await db
    .update(filamentProfiles)
    .set({ ...data, updatedAt: now })
    .where(eq(filamentProfiles.id, id))
    .returning();
  revalidatePath("/profiles");
  revalidatePath("/filaments");
  return row;
}
