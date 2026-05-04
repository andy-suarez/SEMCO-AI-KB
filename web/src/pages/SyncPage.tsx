import { useEffect, useState } from "react";
import { CloudUpload, Download } from "lucide-react";
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
import { getLastLyroSync, type SyncLogEntry, type SyncResponse } from "@/lib/sync";

const LAST_DOWNLOAD_KEY = "lastCsvExport";
const REQUEST_TIMEOUT_MS = 120_000;
const WAKING_NOTICE_DELAY_MS = 5_000;

type DownloadStatus = "idle" | "downloading" | "waking";
type SyncStatus = "idle" | "syncing" | "waking";

export function SyncPage() {
  const [count, setCount] = useState<number | null>(null);
  const [lastDownload, setLastDownload] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<SyncLogEntry | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  useEffect(() => {
    listKBEntries({ limit: 1 })
      .then((r) => setCount(r.count))
      .catch(() => setCount(null));
    setLastDownload(localStorage.getItem(LAST_DOWNLOAD_KEY));
    refreshLastSync();
  }, []);

  function refreshLastSync() {
    getLastLyroSync()
      .then(setLastSync)
      .catch(() => setLastSync(null));
  }

  async function handleDownload() {
    setDownloadStatus("downloading");
    const wakingTimer = window.setTimeout(
      () => setDownloadStatus("waking"),
      WAKING_NOTICE_DELAY_MS
    );
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
      localStorage.setItem(LAST_DOWNLOAD_KEY, now);
      setLastDownload(now);
      toast.success("CSV downloaded");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error(
          "Timed out. The API may still be waking up on the free tier — wait a moment and try again."
        );
      } else {
        toast.error(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      window.clearTimeout(wakingTimer);
      window.clearTimeout(abortTimer);
      setDownloadStatus("idle");
    }
  }

  async function handlePushToLyro() {
    setSyncStatus("syncing");
    const wakingTimer = window.setTimeout(
      () => setSyncStatus("waking"),
      WAKING_NOTICE_DELAY_MS
    );
    const controller = new AbortController();
    const abortTimer = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const res = await apiFetch("/sync/lyro", {
        method: "POST",
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          res.status === 401
            ? "Session expired — please refresh and try again."
            : `Sync failed (${res.status}): ${body.slice(0, 200)}`
        );
      }
      const result = (await res.json()) as SyncResponse;
      if (result.failed > 0) {
        toast.error(
          `${result.succeeded} synced, ${result.failed} failed. First failure on entry ${result.failures[0]?.entry_id}: ${result.failures[0]?.detail.slice(0, 120)}`,
          { duration: 8000 }
        );
      } else {
        toast.success(`Synced ${result.succeeded} entries to Lyro.`);
      }
      refreshLastSync();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error(
          "Sync timed out after 2 minutes. The KB may still be uploading — check sync history before retrying."
        );
        refreshLastSync();
      } else {
        toast.error(err instanceof Error ? err.message : "Sync failed");
      }
    } finally {
      window.clearTimeout(wakingTimer);
      window.clearTimeout(abortTimer);
      setSyncStatus("idle");
    }
  }

  const downloadLabel =
    downloadStatus === "waking"
      ? "Waking up the API…"
      : downloadStatus === "downloading"
      ? "Downloading…"
      : "Download CSV";

  const pushLabel =
    syncStatus === "waking"
      ? "Waking up the API…"
      : syncStatus === "syncing"
      ? "Pushing to Lyro…"
      : "Push to Lyro";

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Sync to Lyro</h1>

      <Card>
        <CardHeader>
          <CardTitle>Push to Lyro</CardTitle>
          <CardDescription>
            {count === null
              ? "Loading…"
              : `Upserts ${count.toLocaleString()} ${count === 1 ? "entry" : "entries"} to Lyro via the Tidio API.`}
            {lastSync && (
              <>
                {" "}
                Last sync: <strong>{describeSync(lastSync)}</strong>
                {lastSync.triggered_by ? ` by ${lastSync.triggered_by}` : ""}.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handlePushToLyro}
            disabled={syncStatus !== "idle" || count === null}
          >
            <CloudUpload className="mr-2 h-4 w-4" />
            {pushLabel}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Download CSV (manual fallback)</CardTitle>
          <CardDescription>
            Use this if the API push fails.
            {lastDownload && ` Last download: ${formatDate(lastDownload)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={downloadStatus !== "idle" || count === null}
          >
            <Download className="mr-2 h-4 w-4" />
            {downloadLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function describeSync(s: SyncLogEntry): string {
  const when = formatDate(s.finished_at ?? s.started_at);
  if (!s.finished_at) return `${when} (in progress?)`;
  if (s.failed > 0) return `${when} — ${s.succeeded}/${s.total_entries} ok, ${s.failed} failed`;
  return `${when} — ${s.succeeded}/${s.total_entries} ok`;
}
