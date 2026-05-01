"""Tidio Lyro OpenAPI client.

Auth is two custom headers (no OAuth token exchange). Each request also
needs `Accept: application/json; version=1` and (for writes)
`Content-Type: application/json; version=1`.

Only one endpoint is used today: PUT /lyro/data-sources/website to upsert
KB content. Lyro deduplicates by URL — pass the same URL twice and the
existing entry is updated. We use a synthetic stable URL per kb_entries
row so each Supabase entry maps to exactly one Lyro data source.
"""

import asyncio
import html as html_lib
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

import httpx

from app.config import get_settings

# Concurrency limit on simultaneous Tidio calls. Tidio doesn't publish a
# rate limit; 10 in flight is well-mannered and finishes 148 entries in
# a few seconds.
MAX_CONCURRENT_REQUESTS = 10
PER_REQUEST_TIMEOUT_S = 20.0


@dataclass
class SyncEntry:
    """The minimum subset of a kb_entries row needed for a Lyro upsert."""

    id: int
    question: str
    answer: str
    category: str
    products: List[str]
    substrates: List[str]


@dataclass
class SyncFailure:
    entry_id: int
    status: Optional[int]
    detail: str


@dataclass
class SyncResult:
    succeeded: int = 0
    failed: int = 0
    failures: List[SyncFailure] = field(default_factory=list)


def _synthetic_url(entry_id: int) -> str:
    """Stable, unique, non-resolving URL used as Lyro's dedupe key."""
    return f"https://semco-kb.internal/entry/{entry_id}"


def _render_content(entry: SyncEntry) -> str:
    """Wrap the entry as escaped HTML for Lyro to ingest."""
    products = ", ".join(entry.products) if entry.products else ""
    substrates = ", ".join(entry.substrates) if entry.substrates else ""

    parts = [
        f"<h1>{html_lib.escape(entry.question)}</h1>",
        f"<p>{html_lib.escape(entry.answer)}</p>",
    ]
    if entry.category:
        parts.append(f"<p><strong>Category:</strong> {html_lib.escape(entry.category)}</p>")
    if products:
        parts.append(f"<p><strong>Products:</strong> {html_lib.escape(products)}</p>")
    if substrates:
        parts.append(f"<p><strong>Substrates:</strong> {html_lib.escape(substrates)}</p>")
    return "\n".join(parts)


def _headers() -> "dict[str, str]":
    settings = get_settings()
    if not settings.lyro_client_id or not settings.lyro_client_secret:
        raise RuntimeError(
            "Tidio Lyro credentials missing — set LYRO_CLIENT_ID and "
            "LYRO_CLIENT_SECRET on the API service."
        )
    return {
        "X-Tidio-Openapi-Client-Id": settings.lyro_client_id,
        "X-Tidio-Openapi-Client-Secret": settings.lyro_client_secret,
        "Accept": "application/json; version=1",
        "Content-Type": "application/json; version=1",
    }


async def _upsert_one(
    client: httpx.AsyncClient,
    headers: "dict[str, str]",
    base_url: str,
    entry: SyncEntry,
    semaphore: asyncio.Semaphore,
) -> Optional[SyncFailure]:
    """Push one entry; return None on success, a SyncFailure on error."""
    async with semaphore:
        try:
            resp = await client.put(
                f"{base_url}/lyro/data-sources/website",
                headers=headers,
                json={
                    "url": _synthetic_url(entry.id),
                    "title": entry.question[:512],
                    "content": _render_content(entry),
                },
                timeout=PER_REQUEST_TIMEOUT_S,
            )
        except httpx.HTTPError as e:
            return SyncFailure(entry_id=entry.id, status=None, detail=str(e)[:300])

        if resp.status_code in (200, 201):
            return None

        return SyncFailure(
            entry_id=entry.id,
            status=resp.status_code,
            detail=resp.text[:300],
        )


async def sync_entries_to_lyro(entries: Iterable[SyncEntry]) -> SyncResult:
    """Upsert every entry to Lyro concurrently. Returns aggregate counts + failures."""
    settings = get_settings()
    headers = _headers()
    base_url = settings.tidio_api_base_url.rstrip("/")

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    result = SyncResult()

    async with httpx.AsyncClient() as client:
        tasks = [_upsert_one(client, headers, base_url, e, semaphore) for e in entries]
        outcomes = await asyncio.gather(*tasks)

    for failure in outcomes:
        if failure is None:
            result.succeeded += 1
        else:
            result.failed += 1
            result.failures.append(failure)

    return result
