from functools import lru_cache

from .config import get_settings
from .services.devin_client import build_client
from .services.ingest import Ingestor
from .services.lean_checker import LeanChecker
from .services.publication import Publisher
from .services.scheduler import Scheduler


@lru_cache
def get_scheduler() -> Scheduler:
    settings = get_settings()
    checker = LeanChecker(
        settings.lean_project_dir if str(settings.lean_project_dir) not in ("", ".") else None,
        allowed_axioms=settings.allowed_axioms,
        timeout_seconds=settings.lean_timeout_seconds,
    )
    ingestor = Ingestor(settings.artifact_dir, checker)
    return Scheduler(settings, build_client(settings), ingestor, Publisher())
