import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  dismissUnanswered,
  promoteUnanswered,
  type UnansweredQuestion,
} from "@/lib/unanswered";

type Props = {
  item: UnansweredQuestion;
  categories: string[];
  onActionComplete: () => void;
};

const arrayToString = (a: string[]) => a.join(", ");
const stringToArray = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const REASON_LABELS: Record<string, string> = {
  handoff: "handoff to operator",
  inactive: "inactive timeout",
  taken_over_by_operator: "operator joined",
};

export function UnansweredCard({ item, categories, onActionComplete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [productsText, setProductsText] = useState("");
  const [substratesText, setSubstratesText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill the question with the customer's last message when first expanded.
  useEffect(() => {
    if (!expanded || question) return;
    const last = item.customer_messages.at(-1)?.message ?? "";
    setQuestion(last);
  }, [expanded, question, item.customer_messages]);

  const previewMessage =
    item.customer_messages.at(-1)?.message ??
    item.customer_messages[0]?.message ??
    "(no customer message captured)";

  async function handlePromote(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await promoteUnanswered(item.id, {
        question: question.trim(),
        answer: answer.trim(),
        category: category.trim(),
        products: stringToArray(productsText),
        substrates: stringToArray(substratesText),
      });
      toast.success("Promoted to KB");
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to promote");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDismiss() {
    if (!confirm("Dismiss this unanswered question? It won't be added to the KB.")) {
      return;
    }
    setSubmitting(true);
    try {
      await dismissUnanswered(item.id);
      toast.success("Dismissed");
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dismiss");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-background">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className={cn(
          "flex w-full items-start gap-3 p-4 text-left",
          "transition-colors hover:bg-muted/50"
        )}
      >
        {expanded ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm">{previewMessage}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {new Date(item.tidio_event_received_at).toLocaleString()}
            </span>
            {item.reason && (
              <Badge variant="outline">
                {REASON_LABELS[item.reason] ?? item.reason}
              </Badge>
            )}
            <span>{item.customer_messages.length} customer message
              {item.customer_messages.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t p-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Conversation</h3>
              {item.conversation_url && (
                <a
                  href={item.conversation_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Open in Tidio <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              {item.customer_messages.length === 0 ? (
                <p className="text-muted-foreground italic">
                  No customer messages captured. Open in Tidio for full context.
                </p>
              ) : (
                item.customer_messages.map((m) => (
                  <div key={m.id} className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <form onSubmit={handlePromote} className="space-y-3">
            <h3 className="text-sm font-medium">Draft KB entry</h3>

            <div className="grid gap-2">
              <Label htmlFor={`q-${item.id}`}>Question</Label>
              <Textarea
                id={`q-${item.id}`}
                rows={2}
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Edit the customer's question into a clean KB question"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`a-${item.id}`}>Answer</Label>
              <Textarea
                id={`a-${item.id}`}
                rows={4}
                required
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write the answer Lyro should give next time"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor={`c-${item.id}`}>Category</Label>
                <Input
                  id={`c-${item.id}`}
                  list={`unanswered-cat-${item.id}`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Select or type"
                />
                <datalist id={`unanswered-cat-${item.id}`}>
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`p-${item.id}`}>Products</Label>
                <Input
                  id={`p-${item.id}`}
                  value={productsText}
                  onChange={(e) => setProductsText(e.target.value)}
                  placeholder="Comma-separated"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`s-${item.id}`}>Substrates</Label>
              <Input
                id={`s-${item.id}`}
                value={substratesText}
                onChange={(e) => setSubstratesText(e.target.value)}
                placeholder="Comma-separated"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDismiss}
                disabled={submitting}
              >
                Dismiss
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Promote to KB"}
              </Button>
            </div>
          </form>

          {/* Tip about post-promote sync */}
          <p className="text-xs text-muted-foreground">
            Tip: after promoting, click <strong>Push to Lyro</strong> on the Sync
            page so the new answer is live for the next customer.
          </p>
        </div>
      )}
    </div>
  );
}
