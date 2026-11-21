"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, List, Plus } from "lucide-react";
import { FilamentCard } from "@/components/filament-card";
import { FilamentTable } from "@/components/filament-table";
import { useAppDialogs } from "@/components/providers/app-dialogs-provider";
import { MATERIALS } from "@/lib/constants";
import type { FilamentWithProfile } from "@/lib/queries";

type SortKey = "remaining_asc" | "purchased_desc" | "opened_asc";

export function FilamentsListClient({ rows }: { rows: FilamentWithProfile[] }) {
  const { openFilamentDialog } = useAppDialogs();
  const [view, setView] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [material, setMaterial] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("purchased_desc");

  const filtered = useMemo(() => {
    let result = rows;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        ({ filament, profile }) =>
          profile.manufacturer.toLowerCase().includes(q) ||
          profile.productName.toLowerCase().includes(q) ||
          filament.colorName.toLowerCase().includes(q),
      );
    }
    if (material !== "all") {
      result = result.filter(({ profile }) => profile.material === material);
    }
    if (status !== "all") {
      result = result.filter(({ filament }) => filament.status === status);
    } else {
      result = result.filter(({ filament }) => filament.status !== "used_up");
    }

    result = [...result].sort((a, b) => {
      if (sort === "remaining_asc") {
        const pa = a.filament.currentWeightG / (a.filament.registeredWeightG || 1);
        const pb = b.filament.currentWeightG / (b.filament.registeredWeightG || 1);
        return pa - pb;
      }
      if (sort === "purchased_desc") {
        return (b.filament.purchasedAt ?? "").localeCompare(a.filament.purchasedAt ?? "");
      }
      if (sort === "opened_asc") {
        if (!a.filament.openedAt) return 1;
        if (!b.filament.openedAt) return -1;
        return a.filament.openedAt.localeCompare(b.filament.openedAt);
      }
      return 0;
    });

    return result;
  }, [rows, search, material, status, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">フィラメント</h1>
        <Button onClick={openFilamentDialog}>
          <Plus className="size-4" />
          フィラメント登録
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="filament-search"
          placeholder="検索（メーカー・色名・製品名） / キー"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={material} onValueChange={(v) => setMaterial(v ?? "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="素材" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべての素材</SelectItem>
            {MATERIALS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">使用中/未開封</SelectItem>
            <SelectItem value="unopened">未開封</SelectItem>
            <SelectItem value="in_use">使用中</SelectItem>
            <SelectItem value="used_up">使用済み</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="並び替え" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="purchased_desc">購入日が新しい順</SelectItem>
            <SelectItem value="remaining_asc">残量が少ない順</SelectItem>
            <SelectItem value="opened_asc">開封日が古い順</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-1">
          <Button
            variant={view === "card" ? "default" : "outline"}
            size="icon"
            onClick={() => setView("card")}
            aria-label="カード表示"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="icon"
            onClick={() => setView("table")}
            aria-label="テーブル表示"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">該当するフィラメントがありません。</p>
      ) : view === "card" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((row) => (
            <FilamentCard key={row.filament.id} row={row} />
          ))}
        </div>
      ) : (
        <FilamentTable rows={filtered} />
      )}
    </div>
  );
}
