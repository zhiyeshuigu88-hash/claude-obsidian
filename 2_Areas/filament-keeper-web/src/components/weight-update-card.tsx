"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adjustWeightMeasured, adjustWeightUsage } from "@/lib/actions/weight";
import { markUsedUp, overrideSpoolWeight } from "@/lib/actions/filaments";

export function WeightUpdateCard({
  filamentId,
  profileId,
  spoolWeightG,
}: {
  filamentId: number;
  profileId: number;
  spoolWeightG: number;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showSpoolOverride, setShowSpoolOverride] = useState(false);

  const usageForm = useForm<{ usedWeightG: string; note: string }>({
    defaultValues: { usedWeightG: "", note: "" },
  });
  const measuredForm = useForm<{ measuredTotalWeightG: string; note: string }>({
    defaultValues: { measuredTotalWeightG: "", note: "" },
  });
  const spoolForm = useForm<{ spoolWeightG: string }>({
    defaultValues: { spoolWeightG: String(spoolWeightG) },
  });

  async function handleResult(result: { newWeightG: number; clamped: boolean; suggestUsedUp: boolean }) {
    if (result.clamped) {
      toast.warning(`残量を0gにしました（マイナスにはなりません）`);
    } else {
      toast.success(`残量を${result.newWeightG}gに更新しました`);
    }
    if (result.suggestUsedUp) {
      toast("残量が0になりました。「使用済み」に変更しますか？", {
        action: {
          label: "使用済みにする",
          onClick: () => markUsedUp(filamentId),
        },
      });
    }
  }

  async function onSubmitUsage(values: { usedWeightG: string; note: string }) {
    setSubmitting(true);
    try {
      const result = await adjustWeightUsage({
        filamentId,
        usedWeightG: Number(values.usedWeightG),
        note: values.note,
      });
      await handleResult(result);
      usageForm.reset({ usedWeightG: "", note: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitMeasured(values: { measuredTotalWeightG: string; note: string }) {
    setSubmitting(true);
    try {
      const result = await adjustWeightMeasured({
        filamentId,
        measuredTotalWeightG: Number(values.measuredTotalWeightG),
        note: values.note,
      });
      await handleResult(result);
      measuredForm.reset({ measuredTotalWeightG: "", note: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitSpoolOverride(values: { spoolWeightG: string }) {
    setSubmitting(true);
    try {
      await overrideSpoolWeight(profileId, Number(values.spoolWeightG));
      toast.success("スプール自重を更新しました");
      setShowSpoolOverride(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">残量を更新</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="usage">
          <TabsList>
            <TabsTrigger value="usage">方式A：使用量を引く</TabsTrigger>
            <TabsTrigger value="measured">方式B：実測総重量から算出</TabsTrigger>
          </TabsList>
          <TabsContent value="usage" className="space-y-3 pt-3">
            <form onSubmit={usageForm.handleSubmit(onSubmitUsage)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="usedWeightG">使用量(g)</Label>
                <Input id="usedWeightG" type="number" {...usageForm.register("usedWeightG", { required: true })} />
              </div>
              <Button type="submit" disabled={submitting}>
                残量から引く
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="measured" className="space-y-3 pt-3">
            <form onSubmit={measuredForm.handleSubmit(onSubmitMeasured)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="measuredTotalWeightG">実測総重量(g)（スプール込み）</Label>
                <Input
                  id="measuredTotalWeightG"
                  type="number"
                  {...measuredForm.register("measuredTotalWeightG", { required: true })}
                />
                <p className="text-xs text-muted-foreground">
                  スプール自重 {spoolWeightG}g を差し引いて残量を算出します
                </p>
              </div>
              <Button type="submit" disabled={submitting}>
                実測値から算出する
              </Button>
            </form>

            <div className="border-t pt-3">
              {!showSpoolOverride ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => setShowSpoolOverride(true)}
                >
                  空スプールを実測してスプール自重を上書きする
                </Button>
              ) : (
                <form
                  onSubmit={spoolForm.handleSubmit(onSubmitSpoolOverride)}
                  className="flex items-end gap-2"
                >
                  <div className="space-y-1">
                    <Label htmlFor="spoolWeightG">空スプールの実測重量(g)</Label>
                    <Input id="spoolWeightG" type="number" {...spoolForm.register("spoolWeightG")} />
                  </div>
                  <Button type="submit" size="sm" disabled={submitting}>
                    上書きする
                  </Button>
                </form>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
