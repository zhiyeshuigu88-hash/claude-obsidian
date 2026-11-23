import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FILAMENT_STATUS_LABEL } from "@/lib/constants";
import { pricePerGram, remainingPercent } from "@/lib/calc";
import type { FilamentWithProfile } from "@/lib/queries";

export function FilamentTable({ rows }: { rows: FilamentWithProfile[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>色</TableHead>
            <TableHead>メーカー / 製品名</TableHead>
            <TableHead>素材</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">残量</TableHead>
            <TableHead className="text-right">1gあたり単価</TableHead>
            <TableHead>購入日</TableHead>
            <TableHead>開封日</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ filament, profile }) => (
            <TableRow key={filament.id} className="cursor-pointer">
              <TableCell>
                <Link href={`/filaments/${filament.id}`} className="flex items-center gap-2">
                  <span
                    className="size-4 shrink-0 rounded-full border"
                    style={{ backgroundColor: filament.colorHex }}
                  />
                  {filament.colorName}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/filaments/${filament.id}`}>
                  {profile.manufacturer} {profile.productName}
                </Link>
              </TableCell>
              <TableCell>{profile.material}</TableCell>
              <TableCell>
                <Badge variant={filament.status === "used_up" ? "outline" : "default"}>
                  {FILAMENT_STATUS_LABEL[filament.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {filament.currentWeightG}g (
                {Math.round(remainingPercent(filament.currentWeightG, filament.registeredWeightG))}
                %)
              </TableCell>
              <TableCell className="text-right">
                ¥{pricePerGram(filament.priceYen, filament.nominalWeightG).toFixed(2)}
              </TableCell>
              <TableCell>{filament.purchasedAt ?? "-"}</TableCell>
              <TableCell>{filament.openedAt ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
