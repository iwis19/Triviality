"""Run the shared fixed-theorem checker in a credential-free subprocess."""
import importlib.util
import json
import os
from pathlib import Path
import sys


def checker_module():
    path = Path(__file__).with_name("lean_check.py")
    if not path.exists():
        path = Path(__file__).resolve().parents[2] / "swarm-skills/math-research/scripts/lean_check.py"
    spec = importlib.util.spec_from_file_location("hosted_lean_check", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate(request):
    if (not isinstance(request, dict) or set(request) != {"statement", "proof"}
            or not all(isinstance(request[k], str) and request[k].strip() for k in request)
            or len(request["statement"]) > 6000 or len(request["proof"]) > 24000):
        raise ValueError("Expected a bounded formal statement and proof term")


if __name__ == "__main__":
    if sys.platform == "linux":
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (32, 32))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
    request = json.loads(sys.stdin.read(196609))
    validate(request)
    checker = checker_module()
    result = checker.check(**request, executable=os.environ.get("SWARM_LEAN_BIN"), local_only=True)
    result["toolchain"] = checker.LEAN_TOOLCHAIN
    print(json.dumps(result))
