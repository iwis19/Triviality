import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="mathlab-test-"))
os.environ["MATHLAB_DATABASE_URL"] = f"sqlite:///{_TMP / 'test.db'}"
os.environ["MATHLAB_ARTIFACT_DIR"] = str(_TMP / "artifacts")
os.environ["MATHLAB_OWNER_API_KEY"] = "test-owner-key"
os.environ["MATHLAB_DEVIN_PROVIDER"] = "mock"
os.environ["MATHLAB_SCHEDULER_ENABLED"] = "false"
# API/loop tests exercise the checker's static gate only; real `lake` runs live in
# test_lean_checker.py, which builds its own LeanChecker against the lab project.
os.environ["MATHLAB_LEAN_PROJECT_DIR"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

OWNER = {"X-API-Key": "test-owner-key"}


@pytest.fixture(autouse=True)
def fresh_db() -> Iterator[None]:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c
