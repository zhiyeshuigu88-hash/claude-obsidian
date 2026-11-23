import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupPanel } from "@/components/backup-panel";
import { listBackups } from "@/lib/db/backup";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const backups = listBackups();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">バックアップ</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            アプリ起動時に自動でバックアップを作成します（直近7世代を保持）。復元が必要な場合は
            バックアップファイルを <code>data/filament.db</code> に手動で置き換えてください。
          </p>
          <BackupPanel backups={backups} />
        </CardContent>
      </Card>
    </div>
  );
}
