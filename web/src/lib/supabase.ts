import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Set them in .env.local for dev or in Render Static Site env vars for prod."
  );
}

// Supabase invite/recovery links carry tokens + `type=invite|recovery` in the URL
// hash. supabase-js (detectSessionInUrl) consumes and strips that hash as soon as
// the client initializes, so we must read it synchronously at module load — before
// createClient runs — to know whether the visitor arrived via an invite/recovery
// link and therefore still needs to set a password.
const _rawHash =
  typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
export const INITIAL_AUTH_TYPE: string | null = new URLSearchParams(_rawHash).get(
  "type"
);

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "https://semco-ai-kb.onrender.com";
