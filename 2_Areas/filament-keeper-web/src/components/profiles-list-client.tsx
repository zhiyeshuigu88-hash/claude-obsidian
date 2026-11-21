"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Thermometer } from "lucide-react";
import { ProfileFormDialog, type EditingProfile } from "@/components/profile-form-dialog";
import type { getProfiles } from "@/lib/queries";

type ProfileRow = Awaited<ReturnType<typeof getProfiles>>[number];

export function ProfilesListClient({ profiles }: { profiles: ProfileRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingProfile | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">プロファイル</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          新規プロファイル
        </Button>
      </div>

      {profiles.length === 0 ? (
        <p className="text-muted-foreground">
          まだプロファイルがありません。「新規プロファイル」から製品を登録してください。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => {
                setEditing(p);
                setDialogOpen(true);
              }}
            >
              <CardHeader>
                <CardTitle className="text-base">{p.manufacturer}</CardTitle>
                <CardDescription>{p.productName}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{p.material}</Badge>
                <span>{p.diameter}mm</span>
                <span className="flex items-center gap-1">
                  <Thermometer className="size-3.5" />
                  自重{p.spoolWeightG}g
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProfileFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}
