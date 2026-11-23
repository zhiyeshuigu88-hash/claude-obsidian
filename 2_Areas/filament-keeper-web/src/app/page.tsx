import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuickActions } from "@/components/quick-actions";
import { getHomeSummary, getRecentPrintJobs } from "@/lib/queries";
import { formatDateTime, formatGrams, formatYen } from "@/lib/calc";

export const dynamic = "force-dynamic";
import { PRINT_RESULT_LABEL } from "@/lib/constants";

export default async function HomePage() {
  const [summary, recentJobs] = await Promise.all([getHomeSummary(), getRecentPrintJobs(5)]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">ホーム</h1>
        <p className="text-sm text-muted-foreground">Filament Keeper</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">使用中の本数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.activeCount}本</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">総残量</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatGrams(summary.totalRemainingG)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">今月の材料費</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatYen(summary.monthlyMaterialCostYen)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近の印刷ジョブ</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ印刷ログがありません。</p>
          ) : (
            <ul className="divide-y">
              {recentJobs.map(({ job, lines }) => (
                <li key={job.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{job.modelName || "（モデル名未入力）"}</p>
                    <p className="text-muted-foreground">
                      {formatDateTime(job.printedAt)} ・ {PRINT_RESULT_LABEL[job.result]} ・{" "}
                      {lines.map((l) => l.filament.colorName).join(", ")}
                    </p>
                  </div>
                  <p>{formatYen(lines.reduce((s, l) => s + l.line.costYen, 0))}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">クイックアクション</h2>
        <QuickActions />
      </div>

      <p className="text-xs text-muted-foreground">
        <Link href="/filaments" className="underline">
          フィラメント一覧
        </Link>
        {" ・ "}
        <Link href="/profiles" className="underline">
          プロファイル管理
        </Link>
      </p>
    </div>
  );
}
