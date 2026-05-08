import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listChangelog, type ChangelogEntry } from "@/lib/changelog";

const PAGE_SIZE = 50;

const ACTION_VARIANT: Record<
  ChangelogEntry["action"],
  "default" | "secondary" | "outline"
> = {
  create: "default",
  update: "secondary",
  delete: "outline",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function summaryFor(entry: ChangelogEntry): string {
  const snap = entry.snapshot;
  if (!snap) return `Entry #${entry.kb_entry_id ?? "?"}`;
  const q = (snap.question as string | undefined) ?? "";
  const id = entry.kb_entry_id ?? snap.id ?? "?";
  const trimmed = q.length > 100 ? q.slice(0, 100) + "…" : q;
  return `#${id} — ${trimmed}`;
}

export function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listChangelog(PAGE_SIZE, page * PAGE_SIZE);
      setEntries(result.data);
      setCount(result.count);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load changelog");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const showingFrom = count === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, count);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead className="w-24">Action</TableHead>
              <TableHead className="min-w-[14rem]">Entry</TableHead>
              <TableHead className="min-w-[10rem]">Changed</TableHead>
              <TableHead className="w-56">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Loading…
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  No KB changes recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {fmtDate(entry.occurred_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[entry.action]}>
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="line-clamp-2 text-sm">{summaryFor(entry)}</div>
                  </TableCell>
                  <TableCell>
                    {entry.action === "update" && entry.changed_fields?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {entry.changed_fields.map((f) => (
                          <Badge key={f} variant="outline">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.actor_email ?? (
                      <span className="italic">system</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>{count > 0 && `Showing ${showingFrom}–${showingTo} of ${count}`}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            Previous
          </Button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
