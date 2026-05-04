import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CalcInput, Options } from "@/lib/calculator";

type Props = {
  value: CalcInput;
  options: Options | null;
  onChange: (next: CalcInput) => void;
};

export function CalculatorForm({ value, options, onChange }: Props) {
  // Sqft input mode: enter directly OR derive from length × width.
  const [sizeMode, setSizeMode] = useState<"sqft" | "lw">("sqft");
  const [length, setLength] = useState<string>("");
  const [width, setWidth] = useState<string>("");

  // When in L×W mode, push computed sqft into the parent value.
  useEffect(() => {
    if (sizeMode !== "lw") return;
    const l = parseFloat(length);
    const w = parseFloat(width);
    if (Number.isFinite(l) && Number.isFinite(w) && l > 0 && w > 0) {
      const computed = Math.round(l * w * 100) / 100;
      if (computed !== value.sqft) {
        onChange({ ...value, sqft: computed });
      }
    }
  }, [sizeMode, length, width, value, onChange]);

  const set = <K extends keyof CalcInput>(k: K, v: CalcInput[K]) =>
    onChange({ ...value, [k]: v });

  const fabricEnabled = value.fabric_size !== null;

  // First fabric size as default when enabling the checkbox.
  const defaultFabricSize = useMemo(
    () => options?.fabric_sizes[0] ?? "6x75",
    [options]
  );

  return (
    <div className="space-y-5">
      {/* Project size */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Project size</Label>
          <div className="text-xs text-muted-foreground">
            <button
              type="button"
              className={
                sizeMode === "sqft"
                  ? "underline"
                  : "hover:underline"
              }
              onClick={() => setSizeMode("sqft")}
            >
              sq ft
            </button>
            {" · "}
            <button
              type="button"
              className={sizeMode === "lw" ? "underline" : "hover:underline"}
              onClick={() => setSizeMode("lw")}
            >
              length × width
            </button>
          </div>
        </div>

        {sizeMode === "sqft" ? (
          <Input
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(value.sqft) && value.sqft > 0 ? value.sqft : ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              set("sqft", Number.isFinite(n) && n > 0 ? n : 0);
            }}
            placeholder="e.g. 530"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="Length (ft)"
              value={length}
              onChange={(e) => setLength(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              step={0.1}
              placeholder="Width (ft)"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
            <p className="col-span-2 text-xs text-muted-foreground">
              {value.sqft > 0
                ? `Computed: ${value.sqft.toLocaleString()} sq ft`
                : "Enter both length and width."}
            </p>
          </div>
        )}
      </div>

      {/* Finish */}
      <div className="space-y-2">
        <Label htmlFor="calc-finish">Finish</Label>
        <Select
          id="calc-finish"
          value={value.finish_type}
          onChange={(e) => set("finish_type", e.target.value)}
        >
          {(options?.finishes ?? []).map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Sealer */}
      <div className="space-y-2">
        <Label htmlFor="calc-sealer">Sealer</Label>
        <Select
          id="calc-sealer"
          value={value.sealer}
          onChange={(e) => set("sealer", e.target.value)}
        >
          <option value="none">None</option>
          {(options?.sealers ?? []).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Add-ons */}
      <div className="space-y-3">
        <Label>Add-ons</Label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.use_slm}
            onChange={(e) => set("use_slm", e.target.checked)}
            className="h-4 w-4"
          />
          SEMCO Liquid Membrane
        </label>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fabricEnabled}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange({
                    ...value,
                    fabric_size: defaultFabricSize,
                    fabric_qty: value.fabric_qty || 1,
                  });
                } else {
                  onChange({ ...value, fabric_size: null, fabric_qty: 0 });
                }
              }}
              className="h-4 w-4"
            />
            Fabric Reinforcement
          </label>

          {fabricEnabled && (
            <div className="ml-6 grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="calc-fabric-size" className="text-xs">
                  Size
                </Label>
                <Select
                  id="calc-fabric-size"
                  value={value.fabric_size ?? ""}
                  onChange={(e) => set("fabric_size", e.target.value)}
                >
                  {(options?.fabric_sizes ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="calc-fabric-qty" className="text-xs">
                  Quantity
                </Label>
                <Input
                  id="calc-fabric-qty"
                  type="number"
                  min={1}
                  step={1}
                  value={value.fabric_qty || ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    set("fabric_qty", Number.isFinite(n) && n > 0 ? n : 0);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
