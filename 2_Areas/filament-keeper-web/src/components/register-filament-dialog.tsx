"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIAMETERS, MATERIALS } from "@/lib/constants";
import { pricePerGram, formatYen } from "@/lib/calc";
import { fetchProfilesForPicker } from "@/lib/actions/data";
import { createProfile } from "@/lib/actions/profiles";
import { createFilament, updateFilament } from "@/lib/actions/filaments";
import { submitOnCtrlEnter } from "@/components/global-shortcuts";

type ProfileRow = Awaited<ReturnType<typeof fetchProfilesForPicker>>[number];

const NEW_PROFILE = "__new__";

type FormValues = {
  profileId: string;
  newManufacturer: string;
  newProductName: string;
  newMaterial: string;
  newDiameter: string;
  newSpoolWeightG: string;
  colorName: string;
  colorHex: string;
  nominalWeightG: string;
  registeredWeightG: string;
  priceYen: string;
  purchasedAt: string;
  purchasedFrom: string;
  openedAt: string;
  note: string;
};

const emptyValues: FormValues = {
  profileId: "",
  newManufacturer: "",
  newProductName: "",
  newMaterial: "PLA",
  newDiameter: "1.75",
  newSpoolWeightG: "250",
  colorName: "",
  colorHex: "#cccccc",
  nominalWeightG: "1000",
  registeredWeightG: "1000",
  priceYen: "",
  purchasedAt: "",
  purchasedFrom: "",
  openedAt: "",
  note: "",
};

export type EditingFilament = {
  id: number;
  profileId: number;
  colorName: string;
  colorHex: string;
  nominalWeightG: number;
  registeredWeightG: number;
  priceYen: number;
  purchasedAt: string | null;
  purchasedFrom: string | null;
  openedAt: string | null;
  note: string | null;
};

export function RegisterFilamentDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: EditingFilament | null;
  onSaved?: () => void;
}) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [usedSpool, setUsedSpool] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    fetchProfilesForPicker().then(setProfiles);
    if (editing) {
      reset({
        ...emptyValues,
        profileId: String(editing.profileId),
        colorName: editing.colorName,
        colorHex: editing.colorHex,
        nominalWeightG: String(editing.nominalWeightG),
        registeredWeightG: String(editing.registeredWeightG),
        priceYen: String(editing.priceYen),
        purchasedAt: editing.purchasedAt ?? "",
        purchasedFrom: editing.purchasedFrom ?? "",
        openedAt: editing.openedAt ?? "",
        note: editing.note ?? "",
      });
      setUsedSpool(editing.registeredWeightG !== editing.nominalWeightG);
    } else {
      reset(emptyValues);
      setUsedSpool(false);
    }
  }, [open, editing, reset]);

  const profileId = watch("profileId");
  const nominalWeightG = watch("nominalWeightG");
  const priceYen = watch("priceYen");

  useEffect(() => {
    if (!usedSpool) setValue("registeredWeightG", nominalWeightG);
  }, [nominalWeightG, usedSpool, setValue]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => String(p.id) === profileId),
    [profiles, profileId],
  );

  const unitPrice = useMemo(() => {
    const price = Number(priceYen);
    const nominal = Number(nominalWeightG);
    if (!price || !nominal) return null;
    return pricePerGram(price, nominal);
  }, [priceYen, nominalWeightG]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      let profileIdToUse: number;

      if (values.profileId === NEW_PROFILE || !values.profileId) {
        if (!values.newManufacturer || !values.newProductName) {
          toast.error("新規プロファイルにはメーカーと製品名が必要です");
          setSubmitting(false);
          return;
        }
        const newProfile = await createProfile({
          manufacturer: values.newManufacturer,
          productName: values.newProductName,
          material: values.newMaterial,
          diameter: Number(values.newDiameter),
          spoolWeightG: Number(values.newSpoolWeightG),
        });
        profileIdToUse = newProfile.id;
      } else {
        profileIdToUse = Number(values.profileId);
      }

      const payload = {
        profileId: profileIdToUse,
        colorName: values.colorName,
        colorHex: values.colorHex,
        nominalWeightG: Number(values.nominalWeightG),
        registeredWeightG: Number(values.registeredWeightG),
        priceYen: Number(values.priceYen),
        purchasedAt: values.purchasedAt,
        purchasedFrom: values.purchasedFrom,
        openedAt: values.openedAt,
        note: values.note,
      };

      if (editing) {
        await updateFilament(editing.id, payload);
        toast.success("フィラメントを更新しました");
      } else {
        await createFilament(payload);
        toast.success("フィラメントを登録しました");
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "フィラメントを編集" : "フィラメントを登録"}</DialogTitle>
          <DialogDescription>
            プロファイル（製品）を選び、このスプール固有の情報を入力してください。
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          onKeyDown={submitOnCtrlEnter}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label>プロファイル</Label>
            <Select
              value={profileId}
              onValueChange={(v) => v && setValue("profileId", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="プロファイルを選択" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.manufacturer} / {p.productName}（{p.material}）
                  </SelectItem>
                ))}
                <SelectItem value={NEW_PROFILE}>＋ 新しいプロファイルを作成</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedProfile && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              素材: {selectedProfile.material} / 直径: {selectedProfile.diameter}mm / スプール自重:{" "}
              {selectedProfile.spoolWeightG}g
            </div>
          )}

          {(profileId === NEW_PROFILE || !profileId) && (
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
              <div className="col-span-2 text-sm font-medium">新規プロファイル</div>
              <div className="space-y-1">
                <Label htmlFor="newManufacturer">メーカー</Label>
                <Input id="newManufacturer" {...register("newManufacturer")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newProductName">製品名</Label>
                <Input id="newProductName" {...register("newProductName")} />
              </div>
              <div className="space-y-1">
                <Label>素材</Label>
                <Select
                  value={watch("newMaterial")}
                  onValueChange={(v) => v && setValue("newMaterial", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIALS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>直径</Label>
                <Select
                  value={watch("newDiameter")}
                  onValueChange={(v) => v && setValue("newDiameter", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAMETERS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}mm
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="newSpoolWeightG">スプール自重(g)</Label>
                <Input id="newSpoolWeightG" type="number" {...register("newSpoolWeightG")} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="colorName">色名</Label>
              <Input id="colorName" {...register("colorName", { required: true })} />
              {errors.colorName && <p className="text-xs text-destructive">必須です</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="colorHex">カラーコード</Label>
              <Input id="colorHex" type="color" {...register("colorHex")} className="h-9 p-1" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nominalWeightG">公称フィラメント重量(g)</Label>
              <Input id="nominalWeightG" type="number" {...register("nominalWeightG")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="priceYen">購入価格(円・税込)</Label>
              <Input id="priceYen" type="number" {...register("priceYen", { required: true })} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={usedSpool}
                onChange={(e) => setUsedSpool(e.target.checked)}
              />
              使いかけスプールとして登録する（残量を公称重量と別に指定）
            </label>
            {usedSpool && (
              <div className="space-y-1">
                <Label htmlFor="registeredWeightG">登録時点の残量(g)</Label>
                <Input id="registeredWeightG" type="number" {...register("registeredWeightG")} />
              </div>
            )}
          </div>

          {unitPrice !== null && (
            <p className="text-sm text-muted-foreground">
              1gあたり単価: {formatYen(unitPrice)}（自動計算・読み取り専用）
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="purchasedAt">購入日</Label>
              <Input id="purchasedAt" type="date" {...register("purchasedAt")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="purchasedFrom">購入先</Label>
              <Input id="purchasedFrom" {...register("purchasedFrom")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="openedAt">開封日</Label>
              <Input id="openedAt" type="date" {...register("openedAt")} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="note">メモ</Label>
            <Textarea id="note" rows={2} {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={submitting}>
              {editing ? "更新する" : "登録する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
