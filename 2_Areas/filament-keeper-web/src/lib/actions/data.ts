"use server";

import { getActiveFilamentsForPicker, getProfiles } from "@/lib/queries";

export async function fetchProfilesForPicker() {
  return getProfiles();
}

export async function fetchFilamentsForPicker() {
  return getActiveFilamentsForPicker();
}
