import { apiFetch } from "@/lib/api";
import type { Permissions } from "@/lib/permissions";

export type UserRow = Permissions & {
  user_id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

export type PermissionPatch = Partial<Permissions>;

export async function listUsers(): Promise<UserRow[]> {
  const res = await apiFetch("/admin/users");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list users (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as UserRow[];
}

export async function updateUserPermissions(
  userId: string,
  patch: PermissionPatch
): Promise<UserRow> {
  const res = await apiFetch(`/admin/users/${userId}/permissions`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.detail ?? text;
    } catch {
      /* ignore */
    }
    throw new Error(detail.slice(0, 300));
  }
  return (await res.json()) as UserRow;
}
