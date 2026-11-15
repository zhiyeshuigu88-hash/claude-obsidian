import { getProfiles } from "@/lib/queries";
import { ProfilesListClient } from "@/components/profiles-list-client";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = await getProfiles();
  return (
    <div className="p-6">
      <ProfilesListClient profiles={profiles} />
    </div>
  );
}
