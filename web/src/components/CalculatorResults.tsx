import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CalcResult } from "@/lib/calculator";

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtMoneyOrDash = (n: number | null | undefined) =>
  n == null ? "—" : fmtMoney(n);

type Props = {
  result: CalcResult | null;
  loading: boolean;
  error: string | null;
};

export function CalculatorResults({ result, loading, error }: Props) {
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-lg border bg-background p-12 text-center text-sm text-muted-foreground">
        {loading ? "Calculating…" : "Enter a square footage to see the estimate."}
      </div>
    );
  }

  return (
    <div className={loading ? "space-y-6 opacity-60 transition-opacity" : "space-y-6"}>
      {result.sections.map((section) => (
        <section key={section.name} className="rounded-lg border bg-background">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold tracking-tight">{section.name}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Product</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Retail</TableHead>
                <TableHead className="w-28 text-right">Wholesale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.items.map((item, idx) => (
                <TableRow key={`${item.product_name}-${item.sku_size}-${idx}`}>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.sku_size}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(item.line_total_retail)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtMoneyOrDash(item.line_total_wholesale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ))}

      <section className="rounded-lg border bg-background">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">Summary</h3>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-4 text-sm">
          <dt className="text-muted-foreground">Item count</dt>
          <dd className="text-right tabular-nums">{result.summary.item_count}</dd>

          <dt className="text-muted-foreground">Total weight</dt>
          <dd className="text-right tabular-nums">
            {result.summary.total_weight_lbs.toLocaleString()} lb
          </dd>

          <dt className="text-muted-foreground">Subtotal (Retail)</dt>
          <dd className="text-right font-medium tabular-nums">
            {fmtMoney(result.summary.subtotal_retail)}
          </dd>

          <dt className="text-muted-foreground">Subtotal (Wholesale)</dt>
          <dd className="text-right text-muted-foreground tabular-nums">
            {fmtMoneyOrDash(result.summary.subtotal_wholesale)}
          </dd>

          <dt className="text-muted-foreground">Cost per sq ft (Retail)</dt>
          <dd className="text-right tabular-nums">
            {fmtMoney(result.summary.cost_per_sqft_retail)}
          </dd>
        </dl>
      </section>
    </div>
  );
}
