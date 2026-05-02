import { useState, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function ManualUnansweredDialog({ open, onOpenChange, onSaved }: Props) {
  const [question, setQuestion] = useState("");
  const [conversationUrl, setConversationUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setQuestion("");
    setConversationUrl("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedQ = question.trim();
    if (!trimmedQ) return;

    setSubmitting(true);
    try {
      const customerMessage = {
        id: crypto.randomUUID(),
        message: trimmedQ,
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("unanswered_questions").insert({
        tidio_contact_id: null,
        tidio_solved_at: null,
        reason: null,
        conversation_url: conversationUrl.trim() || null,
        customer_messages: [customerMessage],
        status: "pending",
      });
      if (error) throw error;
      toast.success("Added to review queue");
      reset();
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add unanswered question</DialogTitle>
          <DialogDescription>
            Paste a customer question from Tidio's Suggestions panel. It joins
            the review queue alongside any webhook-captured questions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="manual-question">Customer question</Label>
            <Textarea
              id="manual-question"
              required
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Paste the customer's question here…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manual-url">Tidio conversation URL (optional)</Label>
            <Input
              id="manual-url"
              type="url"
              value={conversationUrl}
              onChange={(e) => setConversationUrl(e.target.value)}
              placeholder="https://www.tidio.com/panel/conversations/…"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add to queue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
