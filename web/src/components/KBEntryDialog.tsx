import { useEffect, useState, type FormEvent } from "react";
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
import {
  createKBEntry,
  updateKBEntry,
  type KBEntry,
  type KBEntryInput,
} from "@/lib/kb";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: KBEntry | null;
  onSaved: () => void;
};

const empty: KBEntryInput = {
  question: "",
  answer: "",
  category: "",
  products: [],
  substrates: [],
  source: "",
};

const arrayToString = (arr: string[]) => arr.join(", ");
const stringToArray = (s: string): string[] =>
  s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

export function KBEntryDialog({ open, onOpenChange, entry, onSaved }: Props) {
  const editing = entry !== null;
  const [form, setForm] = useState<KBEntryInput>(empty);
  const [productsText, setProductsText] = useState("");
  const [substratesText, setSubstratesText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const seed = entry
        ? {
            question: entry.question,
            answer: entry.answer,
            category: entry.category,
            products: entry.products,
            substrates: entry.substrates,
            source: entry.source,
          }
        : empty;
      setForm(seed);
      setProductsText(arrayToString(seed.products));
      setSubstratesText(arrayToString(seed.substrates));
    }
  }, [open, entry]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload: KBEntryInput = {
      ...form,
      products: stringToArray(productsText),
      substrates: stringToArray(substratesText),
    };

    try {
      if (editing && entry) {
        await updateKBEntry(entry.id, payload);
        toast.success("Entry updated");
      } else {
        await createKBEntry(payload);
        toast.success("Entry created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit entry" : "New entry"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Editing entry #${entry?.id}. Changes save to Supabase immediately and will be picked up on the next Lyro sync.`
              : "Create a new Q&A entry. It saves to Supabase and will be picked up on the next Lyro sync."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="question">Question</Label>
            <Textarea
              id="question"
              required
              rows={2}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="answer">Answer</Label>
            <Textarea
              id="answer"
              required
              rows={5}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Application Inquiry"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="e.g. Excel Repository"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="products">Products</Label>
            <Input
              id="products"
              value={productsText}
              onChange={(e) => setProductsText(e.target.value)}
              placeholder="Comma-separated, e.g. X-Bond Stone, Microbond"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="substrates">Substrates</Label>
            <Input
              id="substrates"
              value={substratesText}
              onChange={(e) => setSubstratesText(e.target.value)}
              placeholder="Comma-separated, e.g. Concrete, Granite"
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
              {submitting ? "Saving…" : editing ? "Save changes" : "Create entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
