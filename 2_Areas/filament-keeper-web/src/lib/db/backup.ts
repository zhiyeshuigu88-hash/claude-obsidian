import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, DB_PATH } from "./client";

const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_GENERATIONS = 7;

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function createBackup(): string | null {
  if (!fs.existsSync(DB_PATH)) return null;

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const dest = path.join(BACKUP_DIR, `filament-${timestamp()}.db`);
  fs.copyFileSync(DB_PATH, dest);

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("filament-") && f.endsWith(".db"))
    .sort();

  const excess = files.length - MAX_GENERATIONS;
  if (excess > 0) {
    for (const f of files.slice(0, excess)) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
  }

  return dest;
}

export function listBackups(): { name: string; path: string; sizeBytes: number; createdAt: string }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("filament-") && f.endsWith(".db"))
    .sort()
    .reverse()
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(full);
      return {
        name: f,
        path: full,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    });
}
