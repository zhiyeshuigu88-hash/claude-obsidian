import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilamentDetailClient } from "@/components/filament-detail-client";
import { WeightUpdateCard } from "@/components/weight-update-card";
import {
  getFilament,
  getPrintJobLinesForFilament,
  getWeightAdjustmentsForFilament,
} from "@/lib/queries";
import { formatDateTime, formatYen, pricePerGram } from "@/lib/calc";
import { PRINT_RESULT_LABEL } from "@/lib/constants";

export default async function FilamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const filamentId = Number(id);
  const data = await getFilament(filamentId);
  if (!data) notFound();

  const [printLines, adjustments] = await Promise.all([
    getPrintJobLinesForFilament(filamentId),
    getWeightAdjustmentsForFilament(filamentId),
  ]);

  const { filament, profile } = data;
  const unitPrice = pricePerGram(filament.priceYen, filament.nominalWeightG);

  return (
    <div className="space-y-6 p-6">
      <FilamentDetailClient data={data} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <InfoRow label="直径" value={`${profile.diameter}mm`} />
            <InfoRow label="スプール自重" value={`${profile.spoolWeightG}g`} />
            <InfoRow label="公称重量" value={`${filament.nominalWeightG}g`} />
            <InfoRow label="登録時点の残量" value={`${filament.registeredWeightG}g`} />
            <InfoRow label="現在の残量" value={`${filament.currentWeightG}g`} />
            <InfoRow label="1gあたり単価" value={formatYen(unitPrice)} />
            <InfoRow label="購入価格" value={formatYen(filament.priceYen)} />
            <InfoRow label="購入日" value={filament.purchasedAt ?? "-"} />
            <InfoRow label="購入先" value={filament.purchasedFrom ?? "-"} />
            <InfoRow label="開封日" value={filament.openedAt ?? "-"} />
            {filament.note && <InfoRow label="メモ" value={filament.note} />}
          </CardContent>
        </Card>

        <WeightUpdateCard
          filamentId={filament.id}
          profileId={profile.id}
          spoolWeightG={profile.spoolWeightG}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">印刷履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {printLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ印刷履歴がありません。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>印刷日時</TableHead>
                  <TableHead>モデル名</TableHead>
                  <TableHead>結果</TableHead>
                  <TableHead className="text-right">使用量</TableHead>
                  <TableHead className="text-right">材料費</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printLines.map(({ line, job }) => (
                  <TableRow key={line.id}>
                    <TableCell>{formatDateTime(job.printedAt)}</TableCell>
                    <TableCell>{job.modelName ?? "-"}</TableCell>
                    <TableCell>{PRINT_RESULT_LABEL[job.result]}</TableCell>
                    <TableCell className="text-right">{line.usedWeightG}g</TableCell>
                    <TableCell className="text-right">{formatYen(line.costYen)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">残量更新履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ更新履歴がありません。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>方式</TableHead>
                  <TableHead className="text-right">入力値</TableHead>
                  <TableHead className="text-right">更新後の残量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{formatDateTime(a.adjustedAt)}</TableCell>
                    <TableCell>{a.method === "usage" ? "使用量を引く" : "実測総重量"}</TableCell>
                    <TableCell className="text-right">{a.valueG}g</TableCell>
                    <TableCell className="text-right">{a.resultingWeightG}g</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </>
  );
}
