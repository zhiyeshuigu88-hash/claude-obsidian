import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FILAMENT_STATUS_LABEL } from "@/lib/constants";
import { remainingPercent } from "@/lib/calc";
import type { FilamentWithProfile } from "@/lib/queries";

export function FilamentCard({ row }: { row: FilamentWithProfile }) {
  const { filament, profile } = row;
  const percent = Math.max(0, Math.min(100, remainingPercent(filament.currentWeightG, filament.registeredWeightG)));

  return (
    <Link href={`/filaments/${filament.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <span
            className="size-8 shrink-0 rounded-full border"
            style={{ backgroundColor: filament.colorHex }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {profile.manufacturer} {profile.productName}
            </p>
            <p className="truncate text-sm text-muted-foreground">{filament.colorName}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{profile.material}</Badge>
            <Badge variant={filament.status === "used_up" ? "outline" : "default"}>
              {FILAMENT_STATUS_LABEL[filament.status]}
            </Badge>
          </div>
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.round(percent)}%（{filament.currentWeightG}g / {filament.registeredWeightG}g）
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
