import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { listKBEntries } from "@/lib/kb";

const LAST_EXPORT_KEY = "lastCsvExport";
const REQUEST_TIMEOUT_MS = 90_000;
const WAKING_NOTICE_DELAY_MS = 5_000;

type Status = "idle" | "downloading" | "waking";

export function SyncPage() {
  const [count, setCount] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    listKBEntries({ limit: 1 })
      .then((r) => setCount(r.count))
      .catch(() => setCount(null));
    setLastExport(localStorage.getItem(LAST_EXPORT_KEY));
  }, []);

  async function handleDownload() {
    setStatus("downloading");

    // After 5s with no response, swap the button label to "Waking up the API…"
    // so the user knows it's a Render cold start, not a hang.
    const wakingTimer = window.setTimeout(
      () => setStatus("waking"),
      WAKING_NOTICE_DELAY_MS
    );

    // Hard timeout so the button can't stay stuck forever.
    const controller = new AbortController();
    const abortTimer = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const res = await apiFetch("/export/csv", { signal: controller.signal });
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Session expired — please refresh and try again."
            : `Export failed (${res.status})`
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `semco_kb_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      localStorage.setItem(LAST_EXPORT_KEY, now);
      setLastExport(now);
      toast.success("CSV downloaded");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error(
          "Timed out after 90s. The API may still be waking up on the free tier — wait a moment and try again."
        );
      } else {
        toast.error(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      window.clearTimeout(wakingTimer);
      window.clearTimeout(abortTimer);
      setStatus("idle");
    }
  }

  const buttonLabel =
    status === "waking"
      ? "Waking up the API…"
      : status === "downloading"
      ? "Downloading…"
      : "Download CSV";

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Sync to Lyro</h1>

      <Card>
        <CardHeader>
          <CardTitle>Download KB CSV</CardTitle>
          <CardDescription>
            {count === null
              ? "Loading…"
              : `${count.toLocaleString()} ${
                  count === 1 ? "entry" : "entries"
                } ready to export.`}
            {lastExport && ` Last download: ${formatDate(lastExport)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleDownload}
            disabled={status !== "idle" || count === null}
          >
            <Download className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload to Tidio</CardTitle>
          <CardDescription>
            After downloading, replace the existing data source in Tidio:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open Tidio admin → Lyro AI → Knowledge sources.</li>
            <li>Find the existing CSV data source and replace / update it.</li>
            <li>Upload the new KB file.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
