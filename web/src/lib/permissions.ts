import { apiFetch } from "@/lib/api";

export type Permissions = {
  can_delete_kb: boolean;
  can_sync_lyro: boolean;
  can_use_calculator: boolean;
  can_see_prices: boolean;
  is_admin: boolean;
};

export const DEFAULT_PERMISSIONS: Permissions = {
  can_delete_kb: false,
  can_sync_lyro: false,
  can_use_calculator: true,
  can_see_prices: true,
  is_admin: false,
};

export async function fetchMyPermissions(): Promise<Permissions> {
  // Render free tier cold starts can return 5xx (or hang and reset)
  // before the service finishes booting, which would otherwise drop
  // admins to default (restricted) permissions until they manually
  // refresh. Retry a couple times so the first page load after sleep
  // outwaits the cold start.
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 5000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await apiFetch("/me/permissions");
      if (res.ok) {
        const body = (await res.json()) as Partial<Permissions>;
        return {
          can_delete_kb: !!body.can_delete_kb,
          can_sync_lyro: !!body.can_sync_lyro,
          can_use_calculator: body.can_use_calculator ?? true,
          can_see_prices: body.can_see_prices ?? true,
          is_admin: !!body.is_admin,
        };
      }
      // Auth failures are definitive — retrying won't change them.
      if (res.status === 401 || res.status === 403) break;
    } catch {
      // Network/timeout — fall through to retry
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  return DEFAULT_PERMISSIONS;
}
