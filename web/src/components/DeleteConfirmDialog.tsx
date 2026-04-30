import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteKBEntry, type KBEntry } from "@/lib/kb";

type Props = {
  entry: KBEntry | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteConfirmDialog({ entry, onOpenChange, onDeleted }: Props) {
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    if (!entry) return;
    setSubmitting(true);
    try {
      await deleteKBEntry(entry.id);
      toast.success("Entry deleted");
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete entry?</DialogTitle>
          <DialogDescription>
            This will permanently remove entry #{entry?.id} from the knowledge base.
            Lyro will keep the old answer until the next CSV sync.
          </DialogDescription>
        </DialogHeader>
        {entry && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{entry.question}</div>
            <div className="mt-1 line-clamp-3 text-muted-foreground">{entry.answer}</div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
            {submitting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
