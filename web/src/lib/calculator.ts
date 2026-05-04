import { apiFetch } from "@/lib/api";

export type CalcInput = {
  sqft: number;
  finish_type: string;
  sealer: string;
  use_slm: boolean;
  fabric_size: string | null;
  fabric_qty: number;
};

export type LineItem = {
  product_name: string;
  sku_size: string;
  qty: number;
  weight_lbs: number | null;
  line_weight_lbs: number | null;
  unit_price_retail: number;
  line_total_retail: number;
  unit_price_wholesale: number | null;
  line_total_wholesale: number | null;
  notes: string | null;
};

export type Section = {
  name: string;
  items: LineItem[];
};

export type Summary = {
  item_count: number;
  total_weight_lbs: number;
  subtotal_retail: number;
  subtotal_wholesale: number | null;
  cost_per_sqft_retail: number;
};

export type CalcResult = {
  input: CalcInput;
  finish_group: string;
  sections: Section[];
  summary: Summary;
};

export type Option = { value: string; label: string };
export type Options = {
  finishes: Option[];
  sealers: Option[];
  fabric_sizes: string[];
};

export async function fetchOptions(): Promise<Options> {
  const res = await apiFetch("/calculator/options");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load options (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Options;
}

export async function fetchEstimate(input: CalcInput): Promise<CalcResult> {
  const res = await apiFetch("/calculator/estimate", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Estimate failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as CalcResult;
}
