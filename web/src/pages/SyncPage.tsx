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

export function SyncPage() {
  const [count, setCount] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    listKBEntries({ limit: 1 })
      .then((r) => setCount(r.count))
      .catch(() => setCount(null));
    setLastExport(localStorage.getItem(LAST_EXPORT_KEY));
  }, []);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await apiFetch("/export/csv");
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
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sync to Lyro</h1>
        <p className="text-sm text-muted-foreground">
          Lyro's Data Source API isn't on our current plan, so syncing is a two-step
          manual flow: download the CSV here, then upload it to Tidio.
        </p>
      </div>

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
          <Button onClick={handleDownload} disabled={downloading || count === null}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Downloading…" : "Download CSV"}
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
            <li>Upload the file you just downloaded.</li>
            <li>Wait for Lyro to re-index (usually a minute or two).</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
