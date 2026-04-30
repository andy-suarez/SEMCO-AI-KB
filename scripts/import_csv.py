"""
One-shot importer: load a Q&A CSV into the kb_entries table on Supabase.

Usage:
    python3 scripts/import_csv.py <path-to-csv>
    python3 scripts/import_csv.py <path-to-csv> --force    # bypass empty-table check

Expected CSV columns (header row required):
    Question, Answer, Category, Products, Substrates, Source

Multi-value Products / Substrates: split on newline, strip whitespace.
Empty Products / Substrates: stored as empty array.
"""

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

# Allow running from repo root: `python3 scripts/import_csv.py ...`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import get_supabase  # noqa: E402


REQUIRED_COLS = {"Question", "Answer", "Category", "Products", "Substrates", "Source"}


def split_array_field(value: str) -> list[str]:
    """Split a CSV cell into a list. Newline-separated, whitespace-trimmed, blanks dropped."""
    if not value:
        return []
    return [part.strip() for part in value.split("\n") if part.strip()]


def row_to_entry(row: dict) -> dict:
    return {
        "question": row["Question"].strip(),
        "answer": row["Answer"].strip(),
        "category": row["Category"].strip(),
        "products": split_array_field(row["Products"]),
        "substrates": split_array_field(row["Substrates"]),
        "source": row["Source"].strip(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", help="Path to the CSV file to import")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Insert even if kb_entries already has rows (will create duplicates)",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        print(f"ERROR: file not found: {csv_path}", file=sys.stderr)
        return 1

    # Read + validate CSV
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = REQUIRED_COLS - set(reader.fieldnames or [])
        if missing:
            print(f"ERROR: CSV missing columns: {sorted(missing)}", file=sys.stderr)
            return 1

        entries = []
        for i, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            if not row["Question"].strip() or not row["Answer"].strip():
                print(f"  skipping row {i}: empty question or answer")
                continue
            entries.append(row_to_entry(row))

    print(f"Parsed {len(entries)} entries from {csv_path.name}")

    # Connect to Supabase
    sb = get_supabase()

    # Safety check — abort if table already has rows, unless --force
    existing = sb.table("kb_entries").select("id", count="exact").limit(1).execute()
    existing_count = existing.count or 0
    if existing_count > 0 and not args.force:
        print(
            f"ABORT: kb_entries already has {existing_count} row(s). "
            "Re-run with --force to insert anyway (will create duplicates), "
            "or truncate the table in Supabase SQL Editor first.",
            file=sys.stderr,
        )
        return 2

    # Batch insert. Supabase client handles a list in a single round trip,
    # but we chunk to keep payloads sane and progress visible.
    chunk_size = 50
    inserted = 0
    for start in range(0, len(entries), chunk_size):
        chunk = entries[start : start + chunk_size]
        result = sb.table("kb_entries").insert(chunk).execute()
        if not result.data:
            print(
                f"ERROR: insert returned no data for chunk starting at row {start}",
                file=sys.stderr,
            )
            return 3
        inserted += len(result.data)
        print(f"  inserted {inserted}/{len(entries)}")

    # Summary
    by_cat = Counter(e["category"] for e in entries)
    print()
    print(f"Done. Inserted {inserted} rows.")
    print("By category:")
    for cat, n in by_cat.most_common():
        print(f"  {cat}: {n}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
