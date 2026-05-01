import { supabase } from "@/lib/supabase";

export type SyncLogEntry = {
  id: number;
  target: "lyro";
  started_at: string;
  finished_at: string | null;
  total_entries: number;
  succeeded: number;
  failed: number;
  triggered_by: string | null;
  error_summary: string | null;
};

export type SyncResponse = {
  log_id: number;
  total: number;
  succeeded: number;
  failed: number;
  failures: Array<{ entry_id: number; status: number | null; detail: string }>;
};

export async function getLastLyroSync(): Promise<SyncLogEntry | null> {
  const { data, error } = await supabase
    .from("sync_log")
    .select("*")
    .eq("target", "lyro")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as SyncLogEntry | null) ?? null;
}
