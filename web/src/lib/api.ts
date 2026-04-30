import { API_BASE_URL, supabase } from "@/lib/supabase";

/**
 * Authed fetch wrapper. Attaches the current Supabase session JWT as a
 * Bearer token. FastAPI's verify_jwt dependency validates it.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
