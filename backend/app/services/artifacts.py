import hashlib
from pathlib import Path

from sqlalchemy.orm import Session

from ..models import Artifact


def store_artifact(
    db: Session,
    root: Path,
    *,
    filename: str,
    content: str,
    media_type: str = "text/plain",
    producer_attempt_id: str | None = None,
    visibility: str = "private",
    manifest: dict | None = None,
) -> Artifact:
    """Content-addressed storage. Identical content yields one file; each producer still gets
    its own Artifact row so provenance is preserved."""
    data = content.encode()
    digest = hashlib.sha256(data).hexdigest()
    root.mkdir(parents=True, exist_ok=True)
    path = root / digest[:2] / digest
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    artifact = Artifact(
        content_hash=digest,
        filename=filename,
        media_type=media_type,
        storage_uri=str(path),
        size_bytes=len(data),
        producer_attempt_id=producer_attempt_id,
        visibility=visibility,
        manifest=manifest or {},
    )
    db.add(artifact)
    db.flush()
    return artifact


def read_artifact(artifact: Artifact) -> str:
    return Path(artifact.storage_uri).read_text()
