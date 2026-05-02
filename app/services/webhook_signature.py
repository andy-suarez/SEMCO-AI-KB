"""HMAC-SHA256 verification for Tidio webhooks.

Tidio sends `x-tidio-signature: t=<timestamp>,s=<hex_signature>`.
The signature covers `{timestamp}.{body}`, signed with the shared
secret from the webhook subscription. Replay-protected by rejecting
timestamps older than `max_age_seconds`.
"""

import hashlib
import hmac
import time


def parse_signature_header(header: str) -> "dict[str, str]":
    """Parse 't=...,s=...' into a dict. Returns empty dict on malformed input."""
    parts: dict[str, str] = {}
    if not header:
        return parts
    for chunk in header.split(","):
        chunk = chunk.strip()
        if "=" in chunk:
            k, _, v = chunk.partition("=")
            parts[k.strip()] = v.strip()
    return parts


def verify_tidio_signature(
    secret: str,
    body: bytes,
    signature_header: str,
    max_age_seconds: int = 300,
    *,
    now: "float | None" = None,
) -> bool:
    """
    Returns True iff the signature is valid AND the timestamp is within
    `max_age_seconds` of the current time. Uses constant-time compare.

    `now` is injectable for tests; defaults to time.time().
    """
    parsed = parse_signature_header(signature_header)
    timestamp_str = parsed.get("t")
    provided = parsed.get("s")
    if not timestamp_str or not provided:
        return False

    try:
        ts = int(timestamp_str)
    except ValueError:
        return False

    current = time.time() if now is None else now
    if abs(current - ts) > max_age_seconds:
        return False

    signed = timestamp_str.encode("utf-8") + b"." + body
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)
