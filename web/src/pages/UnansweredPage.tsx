import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ManualUnansweredDialog } from "@/components/ManualUnansweredDialog";
import { UnansweredCard } from "@/components/UnansweredCard";
import { listKBFacets } from "@/lib/kb";
import {
  listUnanswered,
  type UnansweredQuestion,
  type UnansweredStatus,
} from "@/lib/unanswered";

export function UnansweredPage() {
  const [status, setStatus] = useState<UnansweredStatus>("pending");
  const [items, setItems] = useState<UnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    listKBFacets()
      .then((f) => setCategories(f.categories))
      .catch(() => setCategories([]));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUnanswered(status);
      setItems(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Unanswered Questions
          </h1>
          <p className="text-sm text-muted-foreground">
            Customer questions Lyro couldn't answer. Promote to add to the KB;
            dismiss to ignore.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value as UnansweredStatus)}
          >
            <option value="pending">Pending</option>
            <option value="promoted">Promoted</option>
            <option value="dismissed">Dismissed</option>
          </Select>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add manually
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-background p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-background p-12 text-center text-sm text-muted-foreground">
          {status === "pending" ? (
            <>
              <p>No pending unanswered questions.</p>
              <p className="mt-1 text-xs">
                Add manually from Tidio's Suggestions panel using the button above.
              </p>
            </>
          ) : (
            `No ${status} questions yet.`
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <UnansweredCard
              key={item.id}
              item={item}
              categories={categories}
              onActionComplete={refresh}
            />
          ))}
        </div>
      )}

      <ManualUnansweredDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={refresh}
      />
    </div>
  );
}
