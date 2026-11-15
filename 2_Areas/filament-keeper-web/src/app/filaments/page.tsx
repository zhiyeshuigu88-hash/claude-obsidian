import { getFilaments } from "@/lib/queries";
import { FilamentsListClient } from "@/components/filaments-list-client";

export const dynamic = "force-dynamic";

export default async function FilamentsPage() {
  const rows = await getFilaments({ includeUsedUp: true });
  return (
    <div className="p-6">
      <FilamentsListClient rows={rows} />
    </div>
  );
}
