"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
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
import { createProfile, updateProfile, type ProfileInput } from "@/lib/actions/profiles";
import { submitOnCtrlEnter } from "@/components/global-shortcuts";

export type EditingProfile = {
  id: number;
  manufacturer: string;
  productName: string;
  material: string;
  diameter: number;
  spoolWeightG: number;
  note: string | null;
};

const emptyValues: ProfileInput = {
  manufacturer: "",
  productName: "",
  material: "PLA",
  diameter: 1.75,
  spoolWeightG: 250,
  note: "",
};

export function ProfileFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: EditingProfile | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, watch, setValue, reset } = useForm<ProfileInput>({
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        manufacturer: editing.manufacturer,
        productName: editing.productName,
        material: editing.material,
        diameter: editing.diameter,
        spoolWeightG: editing.spoolWeightG,
        note: editing.note ?? "",
      });
    } else {
      reset(emptyValues);
    }
  }, [open, editing, reset]);

  async function onSubmit(values: ProfileInput) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateProfile(editing.id, values);
        toast.success("プロファイルを更新しました");
      } else {
        await createProfile(values);
        toast.success("プロファイルを作成しました");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "プロファイルを編集" : "プロファイルを作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} onKeyDown={submitOnCtrlEnter} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="manufacturer">メーカー</Label>
              <Input id="manufacturer" {...register("manufacturer", { required: true })} autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="productName">製品名</Label>
              <Input id="productName" {...register("productName", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>素材</Label>
              <Select value={watch("material")} onValueChange={(v) => v && setValue("material", v)}>
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
                value={String(watch("diameter"))}
                onValueChange={(v) => setValue("diameter", Number(v))}
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
              <Label htmlFor="spoolWeightG">スプール自重(g)</Label>
              <Input id="spoolWeightG" type="number" {...register("spoolWeightG")} />
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
              {editing ? "更新する" : "作成する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
