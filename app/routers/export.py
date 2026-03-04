import csv
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.db import get_supabase

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/csv")
def export_csv():
    """
    Export all KB entries as CSV with question + answer columns.
    This is the format Tidio/Lyro expects for data source import.
    """
    sb = get_supabase()

    # Fetch only the two columns Lyro needs
    result = (
        sb.table("kb_entries")
        .select("question, answer")
        .order("id")
        .execute()
    )

    # Write CSV to in-memory buffer
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["question", "answer"])

    for row in result.data:
        writer.writerow([row["question"], row["answer"]])

    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=kb_entries.csv"
        },
    )
