"""Install the unchanged, pinned SwarmFlow engine without the desktop stack.

The same workflow can run natively as a WorkSwarm Swarm Skill. This embedded
adapter uses WorkSwarm's exact Core dependency, not a reimplementation.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
LOCK = json.loads((HERE / "framework-lock.json").read_text())


def install(source=None):
    target = ROOT / ".data" / "swarmflow-runtime"
    core = LOCK["core"]
    with tempfile.TemporaryDirectory(prefix="triviality-framework-") as temp:
        source = Path(source).resolve() if source else Path(temp) / "source"
        if not source.exists():
            subprocess.run(["git", "init", str(source)], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(source), "fetch", "--depth", "1",
                            core["repository"], core["revision"]], check=True)
            subprocess.run(["git", "-C", str(source), "checkout", "--detach", "FETCH_HEAD"], check=True)
        revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
        if revision != core["revision"]:
            raise RuntimeError("Framework source does not match framework-lock.json")
        if subprocess.check_output(["git", "-C", str(source), "status", "--porcelain", "--", core["engine"]], text=True).strip():
            raise RuntimeError("Framework engine has local modifications")
        target.mkdir(parents=True, exist_ok=True)
        engine = target / "triviality_swarmflow_engine"
        shutil.copytree(source / core["engine"], engine, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        shutil.copy2(source / "LICENSE", target / "LICENSE.openjiuwen")
        manifest = {str(p.relative_to(engine)).replace("\\", "/"): hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in engine.rglob("*.py")}
        (target / "manifest.json").write_text(json.dumps({"revision": revision, "files": manifest}, indent=2))
    print(f"Installed unchanged SwarmFlow engine {revision} in {target}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", help="Existing clean Core checkout at the locked revision")
    install(parser.parse_args().source)
