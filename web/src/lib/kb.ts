import { supabase } from "@/lib/supabase";

export type KBEntry = {
  id: number;
  question: string;
  answer: string;
  category: string;
  products: string[];
  substrates: string[];
  source: string;
  created_at: string;
  updated_at: string;
};

export type KBEntryInput = {
  question: string;
  answer: string;
  category: string;
  products: string[];
  substrates: string[];
  source: string;
};

export type KBListFilters = {
  search?: string;
  category?: string;
  source?: string;
  limit?: number;
  offset?: number;
};

export type KBListResult = {
  data: KBEntry[];
  count: number;
};

export async function listKBEntries(filters: KBListFilters = {}): Promise<KBListResult> {
  const { search, category, source, limit = 50, offset = 0 } = filters;
  let query = supabase
    .from("kb_entries")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (source) query = query.eq("source", source);
  if (search?.trim()) {
    // Escape % and , so they're treated as literals in PostgREST's or() syntax.
    const escaped = search.trim().replace(/([\\%,()])/g, "\\$1");
    query = query.or(`question.ilike.%${escaped}%,answer.ilike.%${escaped}%`);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return { data: (data ?? []) as KBEntry[], count: count ?? 0 };
}

export async function createKBEntry(input: KBEntryInput): Promise<KBEntry> {
  const { data, error } = await supabase
    .from("kb_entries")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as KBEntry;
}

export async function updateKBEntry(id: number, input: Partial<KBEntryInput>): Promise<KBEntry> {
  const { data, error } = await supabase
    .from("kb_entries")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as KBEntry;
}

export async function deleteKBEntry(id: number): Promise<void> {
  const { error } = await supabase.from("kb_entries").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Distinct values for filter dropdowns. Pulled with two narrow selects
 * (no need to fetch the full rows) and de-duplicated client-side since
 * Supabase's PostgREST doesn't expose DISTINCT directly.
 */
export async function listKBFacets(): Promise<{ categories: string[]; sources: string[] }> {
  const [cats, srcs] = await Promise.all([
    supabase.from("kb_entries").select("category").order("category"),
    supabase.from("kb_entries").select("source").order("source"),
  ]);
  if (cats.error) throw cats.error;
  if (srcs.error) throw srcs.error;
  const uniq = (arr: { [k: string]: string }[], key: string) =>
    Array.from(new Set(arr.map((r) => r[key]).filter((v) => v && v.length > 0))).sort();
  return {
    categories: uniq(cats.data as { category: string }[], "category"),
    sources: uniq(srcs.data as { source: string }[], "source"),
  };
}
