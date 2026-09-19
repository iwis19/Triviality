import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import private, public, worker
from .auth import ensure_owner
from .config import get_settings
from .db import SessionLocal, create_schema, engine
from .deps import get_scheduler

log = logging.getLogger("mathlab")


async def _scheduler_loop(interval: int) -> None:
    scheduler = get_scheduler()
    while True:
        try:
            with SessionLocal() as db:
                summary = await asyncio.to_thread(scheduler.tick, db)
                if any(summary.values()):
                    log.info("scheduler tick: %s", summary)
        except Exception:  # keep the loop alive; failures are recorded on attempts
            log.exception("scheduler tick failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    create_schema(engine)
    with SessionLocal() as db:
        ensure_owner(db)
    task = None
    if settings.scheduler_enabled:
        task = asyncio.create_task(_scheduler_loop(settings.scheduler_interval_seconds))
    yield
    if task:
        task.cancel()


app = FastAPI(title="MathLab", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(public.router)
app.include_router(private.router)
app.include_router(worker.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "provider": get_scheduler().client.provider_name}
