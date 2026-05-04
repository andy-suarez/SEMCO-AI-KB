import { useEffect, useMemo, useRef, useState } from "react";
import { CalculatorForm } from "@/components/CalculatorForm";
import { CalculatorResults } from "@/components/CalculatorResults";
import { useAuth } from "@/lib/auth";
import {
  fetchEstimate,
  fetchOptions,
  type CalcInput,
  type CalcResult,
  type Options,
} from "@/lib/calculator";

const DEFAULT_INPUT: CalcInput = {
  sqft: 0,
  finish_type: "vellum_solid",
  sealer: "none",
  use_slm: false,
  fabric_size: null,
  fabric_qty: 0,
  brown_coat: null,
};

const DEBOUNCE_MS = 300;

export function CalculatorPage() {
  const { user } = useAuth();
  const storageKey = useMemo(
    () => (user?.id ? `calculator:state:${user.id}` : null),
    [user?.id]
  );

  const [input, setInput] = useState<CalcInput>(DEFAULT_INPUT);
  const [restored, setRestored] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  // Restore state from localStorage on mount.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setInput({ ...DEFAULT_INPUT, ...parsed });
      }
    } catch {
      /* corrupted JSON — ignore */
    }
    setRestored(true);
  }, [storageKey]);

  // Persist state to localStorage on change (debounced).
  useEffect(() => {
    if (!restored || !storageKey) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(input));
      } catch {
        /* quota exceeded or disabled — non-fatal */
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [input, restored, storageKey]);

  // Load dropdown options once.
  useEffect(() => {
    fetchOptions()
      .then((opts) => {
        setOptions(opts);
        // If the persisted finish isn't in the loaded options, fall back to first.
        setInput((cur) => {
          const valid = opts.finishes.some((f) => f.value === cur.finish_type);
          if (valid) return cur;
          return { ...cur, finish_type: opts.finishes[0]?.value ?? cur.finish_type };
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load options"));
  }, []);

  // Re-fetch the estimate whenever inputs change (debounced).
  useEffect(() => {
    if (!restored) return;
    if (!input.sqft || input.sqft <= 0) {
      setResult(null);
      return;
    }
    if (!input.finish_type) return;

    // Brown coat needs all 3 sub-fields to be valid; skip otherwise to avoid 422s.
    if (input.brown_coat) {
      const bc = input.brown_coat;
      if (!bc.length_ft || !bc.width_ft || !bc.thickness_in) {
        // hold off on the API call until the user fills it in
      }
    }

    // Build a payload that strips out brown_coat if it isn't fully populated;
    // the backend rejects partial brown coat with 422 otherwise.
    const payload: CalcInput = (() => {
      if (!input.brown_coat) return input;
      const bc = input.brown_coat;
      const ready = bc.length_ft > 0 && bc.width_ft > 0 && bc.thickness_in > 0;
      return ready ? input : { ...input, brown_coat: null };
    })();

    const myReqId = ++reqIdRef.current;
    const t = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetchEstimate(payload);
        if (reqIdRef.current === myReqId) {
          setResult(r);
        }
      } catch (e) {
        if (reqIdRef.current === myReqId) {
          setError(e instanceof Error ? e.message : "Failed to calculate");
        }
      } finally {
        if (reqIdRef.current === myReqId) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [input, restored]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Product Calculator</h1>

      <div className="grid gap-6 lg:grid-cols-[20rem,1fr]">
        <div className="rounded-lg border bg-background p-5">
          <CalculatorForm value={input} options={options} onChange={setInput} />
        </div>
        <CalculatorResults result={result} loading={loading} error={error} />
      </div>
    </div>
  );
}
