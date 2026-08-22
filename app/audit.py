from datetime import datetime, timezone

from app.database import get_connection


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def log_event(
    request_id: str,
    event_name: str,
    details: str = ""
):
    conn = get_connection()

    conn.execute(
        """
        INSERT INTO audit_log
        (request_id, event_name, timestamp, details)
        VALUES (?, ?, ?, ?)
        """,
        (
            request_id,
            event_name,
            utc_now(),
            details
        )
    )

    conn.commit()
    conn.close()
    