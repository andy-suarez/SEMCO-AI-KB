import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export type CustomerMessage = {
  id: string;
  message: string;
  created_at: string;
};

export type UnansweredQuestion = {
  id: number;
  tidio_contact_id: string;
  tidio_event_received_at: string;
  tidio_solved_at: string | null;
  reason: string | null;
  contact_email: string | null;
  conversation_url: string | null;
  customer_messages: CustomerMessage[];
  status: "pending" | "promoted" | "dismissed";
  promoted_kb_entry_id: number | null;
  draft_answer: string | null;
  draft_category: string | null;
  draft_products: string[];
  draft_substrates: string[];
  handled_at: string | null;
  handled_by: string | null;
};

export type UnansweredStatus = UnansweredQuestion["status"];

export async function listUnanswered(
  status: UnansweredStatus = "pending"
): Promise<UnansweredQuestion[]> {
  const { data, error } = await supabase
    .from("unanswered_questions")
    .select("*")
    .eq("status", status)
    .order("tidio_event_received_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as UnansweredQuestion[];
}

export async function countPendingUnanswered(): Promise<number> {
  const { count, error } = await supabase
    .from("unanswered_questions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export type PromotePayload = {
  question: string;
  answer: string;
  category: string;
  products: string[];
  substrates: string[];
  source?: string;
};

export async function promoteUnanswered(
  unansweredId: number,
  payload: PromotePayload
): Promise<void> {
  const res = await apiFetch(`/unanswered/${unansweredId}/promote`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      source: payload.source ?? "Tidio Unanswered",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Promote failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function dismissUnanswered(unansweredId: number): Promise<void> {
  const res = await apiFetch(`/unanswered/${unansweredId}/dismiss`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dismiss failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
