import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db/client";
import {
  filamentProfiles,
  filaments,
  printJobFilaments,
  printJobs,
  weightAdjustments,
} from "./db/schema";

export async function getProfiles() {
  return db.select().from(filamentProfiles).orderBy(filamentProfiles.manufacturer);
}

export async function getProfile(id: number) {
  const rows = await db.select().from(filamentProfiles).where(eq(filamentProfiles.id, id));
  return rows[0] ?? null;
}

export async function getManufacturerSuggestions() {
  const rows = await db
    .selectDistinct({ manufacturer: filamentProfiles.manufacturer })
    .from(filamentProfiles);
  return rows.map((r) => r.manufacturer);
}

export type FilamentWithProfile = Awaited<ReturnType<typeof getFilaments>>[number];

export async function getFilaments(options?: { includeUsedUp?: boolean }) {
  const rows = await db
    .select({
      filament: filaments,
      profile: filamentProfiles,
    })
    .from(filaments)
    .innerJoin(filamentProfiles, eq(filaments.profileId, filamentProfiles.id))
    .where(isNull(filaments.deletedAt))
    .orderBy(desc(filaments.createdAt));

  if (options?.includeUsedUp) return rows;
  return rows;
}

export async function getFilament(id: number) {
  const rows = await db
    .select({ filament: filaments, profile: filamentProfiles })
    .from(filaments)
    .innerJoin(filamentProfiles, eq(filaments.profileId, filamentProfiles.id))
    .where(and(eq(filaments.id, id), isNull(filaments.deletedAt)));
  return rows[0] ?? null;
}

export async function getActiveFilamentsForPicker() {
  const rows = await db
    .select({ filament: filaments, profile: filamentProfiles })
    .from(filaments)
    .innerJoin(filamentProfiles, eq(filaments.profileId, filamentProfiles.id))
    .where(and(isNull(filaments.deletedAt), sql`${filaments.status} != 'used_up'`))
    .orderBy(desc(filaments.updatedAt));
  return rows;
}

export async function getPrintJobLinesForFilament(filamentId: number) {
  return db
    .select({ line: printJobFilaments, job: printJobs })
    .from(printJobFilaments)
    .innerJoin(printJobs, eq(printJobFilaments.printJobId, printJobs.id))
    .where(eq(printJobFilaments.filamentId, filamentId))
    .orderBy(desc(printJobs.printedAt));
}

export async function getWeightAdjustmentsForFilament(filamentId: number) {
  return db
    .select()
    .from(weightAdjustments)
    .where(eq(weightAdjustments.filamentId, filamentId))
    .orderBy(desc(weightAdjustments.adjustedAt));
}

export async function getRecentPrintJobs(limit = 5) {
  const jobs = await db
    .select()
    .from(printJobs)
    .orderBy(desc(printJobs.printedAt))
    .limit(limit);

  const results = [];
  for (const job of jobs) {
    const lines = await db
      .select({ line: printJobFilaments, filament: filaments, profile: filamentProfiles })
      .from(printJobFilaments)
      .innerJoin(filaments, eq(printJobFilaments.filamentId, filaments.id))
      .innerJoin(filamentProfiles, eq(filaments.profileId, filamentProfiles.id))
      .where(eq(printJobFilaments.printJobId, job.id));
    results.push({ job, lines });
  }
  return results;
}

export async function getHomeSummary() {
  const activeFilaments = await db
    .select()
    .from(filaments)
    .where(and(isNull(filaments.deletedAt), sql`${filaments.status} != 'used_up'`));

  const totalRemainingG = activeFilaments.reduce((sum, f) => sum + f.currentWeightG, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthlyLines = await db
    .select({ costYen: printJobFilaments.costYen, printedAt: printJobs.printedAt })
    .from(printJobFilaments)
    .innerJoin(printJobs, eq(printJobFilaments.printJobId, printJobs.id))
    .where(sql`${printJobs.printedAt} >= ${monthStart}`);

  const monthlyMaterialCostYen = monthlyLines.reduce((sum, l) => sum + l.costYen, 0);

  return {
    activeCount: activeFilaments.length,
    totalRemainingG,
    monthlyMaterialCostYen,
  };
}
