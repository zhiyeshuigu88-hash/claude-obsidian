"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { PRINT_RESULT_OPTIONS } from "@/lib/constants";
import { fetchFilamentsForPicker } from "@/lib/actions/data";
import { createPrintJob } from "@/lib/actions/printJobs";
import { submitOnCtrlEnter } from "@/components/global-shortcuts";
import { Plus, Trash2 } from "lucide-react";

type FilamentRow = Awaited<ReturnType<typeof fetchFilamentsForPicker>>[number];

function nowLocalDateTime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

type FormValues = {
  modelName: string;
  printedAt: string;
  durationMin: string;
  result: "success" | "failure" | "aborted";
  note: string;
  lines: { filamentId: string; usedWeightG: string }[];
};

export function PrintJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [filamentRows, setFilamentRows] = useState<FilamentRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      modelName: "",
      printedAt: nowLocalDateTime(),
      durationMin: "",
      result: "success",
      note: "",
      lines: [{ filamentId: "", usedWeightG: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  useEffect(() => {
    if (!open) return;
    fetchFilamentsForPicker().then(setFilamentRows);
    reset({
      modelName: "",
      printedAt: nowLocalDateTime(),
      durationMin: "",
      result: "success",
      note: "",
      lines: [{ filamentId: "", usedWeightG: "" }],
    });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const result = await createPrintJob({
        modelName: values.modelName,
        printedAt: new Date(values.printedAt).toISOString(),
        durationMin: values.durationMin ? Number(values.durationMin) : undefined,
        result: values.result,
        note: values.note,
        lines: values.lines
          .filter((l) => l.filamentId)
          .map((l) => ({
            filamentId: Number(l.filamentId),
            usedWeightG: Number(l.usedWeightG),
          })),
      });

      if (result.clampedFilamentNames.length > 0) {
        toast.warning(`残量が0になりました: ${result.clampedFilamentNames.join(", ")}`);
      }
      toast.success("印刷ジョブを記録しました");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>印刷ジョブを記録</DialogTitle>
          <DialogDescription>使用したフィラメントと使用量を入力してください。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} onKeyDown={submitOnCtrlEnter} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="modelName">モデル名 / 案件名</Label>
              <Input id="modelName" {...register("modelName")} autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="printedAt">印刷日時</Label>
              <Input id="printedAt" type="datetime-local" {...register("printedAt")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="durationMin">印刷時間(分)</Label>
              <Input id="durationMin" type="number" {...register("durationMin")} />
            </div>
            <div className="space-y-1">
              <Label>結果</Label>
              <Select value={watch("result")} onValueChange={(v) => setValue("result", v as FormValues["result"]) }>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRINT_RESULT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>使用フィラメント</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Select
                    value={watch(`lines.${index}.filamentId`)}
                    onValueChange={(v) => setValue(`lines.${index}.filamentId`, v ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="フィラメントを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {filamentRows.map(({ filament, profile }) => (
                        <SelectItem key={filament.id} value={String(filament.id)}>
                          {profile.manufacturer} {profile.productName} / {filament.colorName}（残
                          {filament.currentWeightG}g）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 space-y-1">
                  <Input
                    type="number"
                    placeholder="使用量(g)"
                    {...register(`lines.${index}.usedWeightG`)}
                  />
                </div>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ filamentId: "", usedWeightG: "" })}
            >
              <Plus className="size-4" />
              フィラメントを追加
            </Button>
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
              記録する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
