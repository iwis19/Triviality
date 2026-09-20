"""Load and integrity-check the isolated upstream SwarmFlow engine."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / ".data" / "swarmflow-runtime"


def load_engine():
    manifest_path = RUNTIME / "manifest.json"
    if not manifest_path.exists():
        raise RuntimeError("Run python apps/research-swarm/setup_runtime.py first")
    manifest = json.loads(manifest_path.read_text())
    lock = json.loads((Path(__file__).parent / "framework-lock.json").read_text())
    if manifest["revision"] != lock["core"]["revision"]:
        raise RuntimeError("SwarmFlow revision changed; rerun setup_runtime.py")
    for name, checksum in manifest["files"].items():
        path = RUNTIME / "triviality_swarmflow_engine" / name
        if hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
            raise RuntimeError(f"SwarmFlow integrity mismatch: {name}")
    sys.path.insert(0, str(RUNTIME))
    import triviality_swarmflow_engine as engine
    return engine
