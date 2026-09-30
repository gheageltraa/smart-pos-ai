import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) return null;
  if (!client) {
    client = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export function getDataProvider() {
  return getSupabaseAdmin() ? "supabase" as const : ENV.databaseUrl ? "mysql" as const : "demo" as const;
}

export function isSupabaseConfigured() {
  return Boolean(ENV.supabaseUrl && ENV.supabaseServiceRoleKey);
}
