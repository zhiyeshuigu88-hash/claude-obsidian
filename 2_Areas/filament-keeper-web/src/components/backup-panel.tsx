"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { runBackupNow } from "@/lib/actions/backup";
import type { listBackups } from "@/lib/db/backup";

export function BackupPanel({ backups }: { backups: ReturnType<typeof listBackups> }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleBackup() {
    setBusy(true);
    try {
      const path = await runBackupNow();
      if (path) {
        toast.success(`バックアップを作成しました: ${path}`);
      } else {
        toast.error("バックアップ対象のデータベースが見つかりません");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "バックアップに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleBackup} disabled={busy}>
        今すぐバックアップ
      </Button>

      {backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだバックアップがありません。</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ファイル名</TableHead>
              <TableHead>作成日時</TableHead>
              <TableHead className="text-right">サイズ</TableHead>
              <TableHead>パス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {backups.map((b) => (
              <TableRow key={b.name}>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.createdAt}</TableCell>
                <TableCell className="text-right">{Math.round(b.sizeBytes / 1024)}KB</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {b.path}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
