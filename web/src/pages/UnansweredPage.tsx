import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Unanswered Questions
          </h1>
          <p className="text-sm text-muted-foreground">
            Customer questions Lyro couldn't answer. Captured automatically via
            Tidio webhook. Promote to add to the KB; dismiss to ignore.
          </p>
        </div>
        <Select
          className="w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value as UnansweredStatus)}
        >
          <option value="pending">Pending</option>
          <option value="promoted">Promoted</option>
          <option value="dismissed">Dismissed</option>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-background p-12 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-background p-12 text-center text-sm text-muted-foreground">
          {status === "pending"
            ? "No pending unanswered questions. Lyro is keeping up."
            : `No ${status} questions yet.`}
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
    </div>
  );
}
