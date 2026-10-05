import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY at runtime.");

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const accounts = [
  { username: "admin", email: "admin@kopipintar.com", password: "adminkopipintar", role: "admin", full_name: "Kopipintar Admin" },
  { username: "kasir", email: "kasir@kopipintar.com", password: "kasirkopipintar", role: "kasir", full_name: "Kopipintar Kasir" },
];

const { data: usersPage, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
for (const account of accounts) {
  const oldUsers = (usersPage.users ?? []).filter(user => user.email === account.email);
  for (const oldUser of oldUsers) {
    const { error } = await supabase.auth.admin.deleteUser(oldUser.id);
    if (error) throw error;
    console.log(`Deleted previous Auth user ${account.username}`);
  }
  const { data, error } = await supabase.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: { username: account.username, full_name: account.full_name } });
  if (error || !data.user) throw error ?? new Error(`No user returned for ${account.username}`);
  const { error: profileError } = await supabase.from("profiles").upsert({ id: data.user.id, username: account.username, full_name: account.full_name, role: account.role, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (profileError) throw profileError;
  console.log(`Created ${account.username} (${account.role}) with id ${data.user.id}`);
}
console.log("Supabase Auth provisioning complete.");
