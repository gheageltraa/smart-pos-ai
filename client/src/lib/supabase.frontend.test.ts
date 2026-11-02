import { describe, expect, it } from "vitest";

describe("frontend Supabase configuration", () => {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  it.skipIf(!url || !anonKey)(
    "can reach the REST API with the supplied anon key",
    async () => {
      expect(url).toBeTruthy();
      expect(anonKey).toBeTruthy();

      const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey}` },
    });
      expect(response.ok).toBe(true);
    },
    15_000,
  );
});
