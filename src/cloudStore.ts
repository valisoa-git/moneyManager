import { normalizeStore } from "./storage";
import { supabase } from "./supabaseClient";
import type { Store } from "./types";

const STORE_TABLE = "user_stores";

export async function loadCloudStore(userId: string) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(STORE_TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.data ? normalizeStore(data.data) : null;
}

export async function saveCloudStore(userId: string, store: Store) {
  if (!supabase) return;

  const { error } = await supabase.from(STORE_TABLE).upsert({
    user_id: userId,
    data: store,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
