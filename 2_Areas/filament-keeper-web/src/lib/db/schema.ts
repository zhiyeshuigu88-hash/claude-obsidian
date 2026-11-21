import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const filamentProfiles = sqliteTable("filament_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  manufacturer: text("manufacturer").notNull(),
  productName: text("product_name").notNull(),
  material: text("material").notNull(),
  diameter: real("diameter").notNull().default(1.75),
  spoolWeightG: integer("spool_weight_g").notNull().default(250),
  nozzleTempC: integer("nozzle_temp_c"),
  bedTempC: integer("bed_temp_c"),
  speedMms: integer("speed_mms"),
  fanPercent: integer("fan_percent"),
  note: text("note"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// 使用中 / 未開封 / 使用済み
export type FilamentStatus = "unopened" | "in_use" | "used_up";

export const filaments = sqliteTable("filaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => filamentProfiles.id),
  colorName: text("color_name").notNull(),
  colorHex: text("color_hex").notNull(),
  nominalWeightG: integer("nominal_weight_g").notNull().default(1000),
  registeredWeightG: integer("registered_weight_g").notNull(),
  currentWeightG: integer("current_weight_g").notNull(),
  priceYen: integer("price_yen").notNull(),
  purchasedAt: text("purchased_at"),
  purchasedFrom: text("purchased_from"),
  openedAt: text("opened_at"),
  storageLocationId: integer("storage_location_id"),
  status: text("status").notNull().default("unopened").$type<FilamentStatus>(),
  note: text("note"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  deletedAt: text("deleted_at"),
});

// 成功 / 失敗 / 途中中止
export type PrintJobResult = "success" | "failure" | "aborted";

export const printJobs = sqliteTable("print_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelName: text("model_name"),
  printedAt: text("printed_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  durationMin: integer("duration_min"),
  result: text("result").notNull().$type<PrintJobResult>(),
  note: text("note"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const printJobFilaments = sqliteTable("print_job_filaments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  printJobId: integer("print_job_id")
    .notNull()
    .references(() => printJobs.id),
  filamentId: integer("filament_id")
    .notNull()
    .references(() => filaments.id),
  usedWeightG: integer("used_weight_g").notNull(),
  costYen: integer("cost_yen").notNull(),
});

export const dryLogs = sqliteTable("dry_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filamentId: integer("filament_id")
    .notNull()
    .references(() => filaments.id),
  driedAt: text("dried_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  temperatureC: integer("temperature_c"),
  durationMin: integer("duration_min"),
  note: text("note"),
});

// usage = 方式A(使用量を引く) / measured = 方式B(実測総重量から算出)
export type WeightAdjustmentMethod = "usage" | "measured";

export const weightAdjustments = sqliteTable("weight_adjustments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filamentId: integer("filament_id")
    .notNull()
    .references(() => filaments.id),
  method: text("method").notNull().$type<WeightAdjustmentMethod>(),
  valueG: integer("value_g").notNull(),
  resultingWeightG: integer("resulting_weight_g").notNull(),
  adjustedAt: text("adjusted_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  note: text("note"),
});

export const storageLocations = sqliteTable("storage_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  replaceIntervalDays: integer("replace_interval_days").notNull().default(60),
});

export const desiccantLogs = sqliteTable("desiccant_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storageLocationId: integer("storage_location_id")
    .notNull()
    .references(() => storageLocations.id),
  replacedAt: text("replaced_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  note: text("note"),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
