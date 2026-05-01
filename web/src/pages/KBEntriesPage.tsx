import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KBEntryDialog } from "@/components/KBEntryDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { listKBEntries, listKBFacets, type KBEntry } from "@/lib/kb";

const PAGE_SIZE = 50;

export function KBEntriesPage() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);

  const [facets, setFacets] = useState<{ categories: string[]; sources: string[] }>({
    categories: [],
    sources: [],
  });

  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<KBEntry | null>(null);

  // Debounce search input so we don't hammer Supabase on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listKBEntries({
        search: debouncedSearch,
        category: category || undefined,
        source: source || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setEntries(result.data);
      setCount(result.count);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, source, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Reset to page 0 when filters change (but not when page changes).
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, category, source]);

  // Load filter facets once on mount.
  useEffect(() => {
    listKBFacets().then(setFacets).catch(() => {
      /* non-fatal — filters just won't have suggestions */
    });
  }, []);

  function openNew() {
    setEditingEntry(null);
    setDialogOpen(true);
  }

  function openEdit(entry: KBEntry) {
    setEditingEntry(entry);
    setDialogOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const showingFrom = count === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, count);

  const filtersActive = useMemo(
    () => Boolean(debouncedSearch || category || source),
    [debouncedSearch, category, source]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">KB Entries</h1>
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "entry" : "entries"}
            {filtersActive ? " matching filters" : ""}.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New entry
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search question or answer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-56"
        >
          <option value="">All categories</option>
          {facets.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-56"
        >
          <option value="">All sources</option>
          {facets.sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {filtersActive && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setCategory("");
              setSource("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead className="min-w-[14rem]">Question</TableHead>
              <TableHead className="min-w-[16rem]">Answer</TableHead>
              <TableHead className="w-44">Category</TableHead>
              <TableHead className="w-48">Products</TableHead>
              <TableHead className="w-44">Substrates</TableHead>
              <TableHead className="w-36">Source</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  Loading…
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  No entries match these filters.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground">{entry.id}</TableCell>
                  <TableCell className="font-medium">
                    <div className="line-clamp-3">{entry.question}</div>
                  </TableCell>
                  <TableCell>
                    <div className="line-clamp-3 text-muted-foreground">{entry.answer}</div>
                  </TableCell>
                  <TableCell>
                    {entry.category && <Badge variant="secondary">{entry.category}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {entry.products.map((p) => (
                        <Badge key={p} variant="outline">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {entry.substrates.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.source}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(entry)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingEntry(entry)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {count > 0 && `Showing ${showingFrom}–${showingTo} of ${count}`}
        </div>
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

      <KBEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editingEntry}
        onSaved={refresh}
        categories={facets.categories}
        sources={facets.sources}
      />
      <DeleteConfirmDialog
        entry={deletingEntry}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        onDeleted={refresh}
      />
    </div>
  );
}
