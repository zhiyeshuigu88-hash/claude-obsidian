"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { RegisterFilamentDialog, type EditingFilament } from "@/components/register-filament-dialog";
import { duplicateFilament, softDeleteFilament } from "@/lib/actions/filaments";
import { FILAMENT_STATUS_LABEL } from "@/lib/constants";
import type { getFilament } from "@/lib/queries";

type FilamentDetail = NonNullable<Awaited<ReturnType<typeof getFilament>>>;

export function FilamentDetailClient({ data }: { data: FilamentDetail }) {
  const { filament, profile } = data;
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const editing: EditingFilament = {
    id: filament.id,
    profileId: filament.profileId,
    colorName: filament.colorName,
    colorHex: filament.colorHex,
    nominalWeightG: filament.nominalWeightG,
    registeredWeightG: filament.registeredWeightG,
    priceYen: filament.priceYen,
    purchasedAt: filament.purchasedAt,
    purchasedFrom: filament.purchasedFrom,
    openedAt: filament.openedAt,
    note: filament.note,
  };

  async function handleDuplicate() {
    setBusy(true);
    try {
      const created = await duplicateFilament(filament.id);
      toast.success("同じスプールをもう1本登録しました");
      router.push(`/filaments/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("このフィラメントを削除しますか？（過去の印刷履歴は保持されます）")) return;
    setBusy(true);
    try {
      await softDeleteFilament(filament.id);
      toast.success("削除しました");
      router.push("/filaments");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className="size-10 shrink-0 rounded-full border"
          style={{ backgroundColor: filament.colorHex }}
        />
        <div>
          <h1 className="text-xl font-semibold">
            {profile.manufacturer} {profile.productName} / {filament.colorName}
          </h1>
          <div className="mt-1 flex gap-1.5">
            <Badge variant="secondary">{profile.material}</Badge>
            <Badge variant={filament.status === "used_up" ? "outline" : "default"}>
              {FILAMENT_STATUS_LABEL[filament.status]}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={busy}>
          <Copy className="size-4" />
          もう1本登録
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={busy}>
          <Pencil className="size-4" />
          編集
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete} disabled={busy}>
          <Trash2 className="size-4" />
          削除
        </Button>
      </div>
      <RegisterFilamentDialog open={editOpen} onOpenChange={setEditOpen} editing={editing} />
    </div>
  );
}
