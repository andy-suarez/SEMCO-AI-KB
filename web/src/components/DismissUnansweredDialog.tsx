import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DISPOSITION_LABELS,
  DISPOSITION_OPTIONS,
  dismissUnanswered,
  type Disposition,
} from "@/lib/unanswered";

type Props = {
  unansweredId: number | null;
  onOpenChange: (open: boolean) => void;
  onDismissed: () => void;
};

export function DismissUnansweredDialog({
  unansweredId,
  onOpenChange,
  onDismissed,
}: Props) {
  const [disposition, setDisposition] = useState<Disposition | "">("");
  const [submitting, setSubmitting] = useState(false);
  const open = unansweredId !== null;

  // Clear the field when the dialog opens for a new entry.
  useEffect(() => {
    if (open) setDisposition("");
  }, [open]);

  async function handleSubmit() {
    if (!disposition || unansweredId === null) return;
    setSubmitting(true);
    try {
      await dismissUnanswered(unansweredId, disposition);
      toast.success(`Dismissed: ${DISPOSITION_LABELS[disposition]}`);
      onDismissed();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dismiss");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dismiss this question?</DialogTitle>
          <DialogDescription>
            Pick a reason. Dismissed entries stay in the queue under the
            "Dismissed" filter for reference.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="dismiss-disposition">Reason</Label>
          <Select
            id="dismiss-disposition"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as Disposition | "")}
            disabled={submitting}
          >
            <option value="">Select a reason…</option>
            {DISPOSITION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {DISPOSITION_LABELS[d]}
              </option>
            ))}
          </Select>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || !disposition}
          >
            {submitting ? "Dismissing…" : "Dismiss"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
