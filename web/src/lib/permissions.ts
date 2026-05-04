import { apiFetch } from "@/lib/api";

export type Permissions = {
  can_delete_kb: boolean;
  can_sync_lyro: boolean;
  can_use_calculator: boolean;
  can_see_prices: boolean;
};

export const DEFAULT_PERMISSIONS: Permissions = {
  can_delete_kb: false,
  can_sync_lyro: false,
  can_use_calculator: true,
  can_see_prices: true,
};

export async function fetchMyPermissions(): Promise<Permissions> {
  const res = await apiFetch("/me/permissions");
  if (!res.ok) {
    // On any failure, fall back to defaults so the UI still renders.
    return DEFAULT_PERMISSIONS;
  }
  const body = (await res.json()) as Partial<Permissions>;
  return {
    can_delete_kb: !!body.can_delete_kb,
    can_sync_lyro: !!body.can_sync_lyro,
    can_use_calculator: body.can_use_calculator ?? true,
    can_see_prices: body.can_see_prices ?? true,
  };
}
