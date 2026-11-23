import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "filament.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

declare global {
  var __filamentDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
  var __filamentSqlite: Database.Database | undefined;
}

const sqlite = globalThis.__filamentSqlite ?? new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = globalThis.__filamentDb ?? drizzle(sqlite, { schema });

if (process.env.NODE_ENV !== "production") {
  globalThis.__filamentSqlite = sqlite;
  globalThis.__filamentDb = db;
}

let migrated = false;
export function ensureMigrated() {
  if (migrated) return;
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  migrated = true;
}

export { DB_PATH, DATA_DIR };
