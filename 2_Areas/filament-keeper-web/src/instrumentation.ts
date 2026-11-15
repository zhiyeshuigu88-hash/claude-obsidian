export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureMigrated } = await import("@/lib/db/client");
  const { createBackup } = await import("@/lib/db/backup");

  ensureMigrated();
  const backupPath = createBackup();
  if (backupPath) {
    console.log(`[filament-keeper] 起動時バックアップを作成しました: ${backupPath}`);
  }
}
