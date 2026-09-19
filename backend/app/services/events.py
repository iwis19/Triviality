from sqlalchemy.orm import Session

from ..models import Event


def emit(
    db: Session,
    type: str,
    *,
    record_type: str = "",
    record_id: str = "",
    payload: dict | None = None,
    visibility: str = "private",
) -> Event:
    """Write to the outbox inside the caller's transaction. Never flush secrets here."""
    event = Event(
        type=type,
        record_type=record_type,
        record_id=record_id,
        payload=payload or {},
        visibility=visibility,
    )
    db.add(event)
    return event
