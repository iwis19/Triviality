import hashlib
import hmac
import secrets

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Attempt, Collaborator


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def new_api_key(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def ensure_owner(db: Session) -> None:
    """Bootstrap the owner from settings so the first private request can succeed."""
    settings = get_settings()
    owner_hash = hash_key(settings.owner_api_key)
    existing = db.scalar(select(Collaborator).where(Collaborator.role == "owner"))
    if existing is None:
        db.add(Collaborator(name="owner", role="owner", api_key_hash=owner_hash))
        db.commit()
    elif existing.api_key_hash != owner_hash:
        existing.api_key_hash = owner_hash
        db.commit()


def require_collaborator(
    x_api_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Collaborator:
    if not x_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-API-Key")
    collaborator = db.scalar(
        select(Collaborator).where(Collaborator.api_key_hash == hash_key(x_api_key))
    )
    if collaborator is None or collaborator.revoked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid or revoked key")
    return collaborator


def require_owner(collaborator: Collaborator = Depends(require_collaborator)) -> Collaborator:
    if collaborator.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Owner permission required")
    return collaborator


def require_worker_attempt(
    attempt_id: str,
    x_worker_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Attempt:
    """Workers authenticate with an attempt-scoped token issued at dispatch time."""
    if not x_worker_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-Worker-Token")
    attempt = db.get(Attempt, attempt_id)
    if attempt is None or not attempt.worker_token_hash:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown attempt")
    if not hmac.compare_digest(attempt.worker_token_hash, hash_key(x_worker_token)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid worker token")
    if attempt.status not in {"queued", "running"}:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Attempt is {attempt.status}")
    return attempt
