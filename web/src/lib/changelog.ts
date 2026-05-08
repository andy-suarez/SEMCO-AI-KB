import { apiFetch } from "@/lib/api";

export type ChangelogAction = "create" | "update" | "delete";

export type ChangelogEntry = {
  id: number;
  kb_entry_id: number | null;
  action: ChangelogAction;
  actor_user_id: string | null;
  actor_email: string | null;
  snapshot: Record<string, unknown> | null;
  changed_fields: string[] | null;
  occurred_at: string;
};

export type ChangelogPage = {
  data: ChangelogEntry[];
  count: number;
};

export async function listChangelog(
  limit = 50,
  offset = 0
): Promise<ChangelogPage> {
  const res = await apiFetch(`/changelog/?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load changelog (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ChangelogPage;
}
