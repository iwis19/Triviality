"""Check a fixed theorem using Lean; model opinions never set verified=True."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

FORBIDDEN = re.compile(
    r"\b(sorry|admit|axiom|unsafe|native_decide|implemented_by|run_tac|run_elab|"
    r"elab|macro|syntax|initialize|builtin_initialize|set_option|import|namespace|"
    r"section|end|theorem|lemma|def|opaque|constant|instance|attribute|example|"
    r"by_elab|eval_expr|IO|Lean)\b|[#;]"
)
ALLOWED_AXIOMS = {"propext", "Classical.choice", "Quot.sound"}
LEAN_TOOLCHAIN = "leanprover/lean4:v4.19.0"


def lean_executable(executable=None):
    """Resolve Lean before entering the temporary proof directory."""
    configured = str(executable or os.environ.get("SWARM_LEAN_BIN", "")).strip()
    if configured:
        path = Path(configured).expanduser()
        if path.is_absolute() or "/" in configured or "\\" in configured:
            return str(path.resolve())
        return shutil.which(configured) or configured

    binary = "lean.exe" if os.name == "nt" else "lean"
    elan_home = Path(os.environ.get("ELAN_HOME") or Path.home() / ".elan").expanduser()
    toolchain_dir = LEAN_TOOLCHAIN.replace("/", "--").replace(":", "---")
    installed = elan_home / "toolchains" / toolchain_dir / "bin" / binary
    if installed.is_file():
        return str(installed.resolve())

    if os.name == "nt":
        root = Path(__file__).resolve().parents[3]
        bundled = root / ".data/lean/lean-4.19.0-windows/bin/lean.exe"
        if bundled.is_file():
            return str(bundled)

    return shutil.which(binary) or binary


def check(statement, proof, *, executable=None, timeout=30):
    result = {"verified": False, "checker": "", "axioms": [], "log": "", "lean": "",
              "theoremName": "triviality_target", "statement": statement}
    # Statements and proof terms are inserted into an application-owned wrapper.
    # Deliberately conservative: this demo supports ordinary Std tactics only.
    if not isinstance(statement, str) or not isinstance(proof, str) or not statement.strip() or not proof.strip():
        result["checker"] = "Missing formal statement or proof term"
        return result
    if len(statement) > 6000 or len(proof) > 24000:
        result["checker"] = "Formal artifact exceeds size limit"
        return result
    if ":=" in statement or any(x in statement + proof for x in ["--", "/-", "-/", "\"", "`", "«", "»", "\\"]):
        result["checker"] = "Rejected comments, quoting, or declaration assignment in formal input"
        return result
    if FORBIDDEN.search(statement + "\n" + proof):
        result["checker"] = "Rejected unsupported command or unsafe proof construct"
        return result
    # Both values may be multiline but cannot escape the declaration's indentation.
    source = "import Std\n\ntheorem triviality_target\n  " + statement.strip().replace("\n", "\n  ")
    source += " :=\n  " + proof.strip().replace("\n", "\n  ")
    source += "\n\n#print axioms triviality_target\n"
    result["lean"] = source
    executable = lean_executable(executable)
    try:
        with tempfile.TemporaryDirectory(prefix="triviality-proof-") as directory:
            path = Path(directory) / "Proof.lean"
            path.write_text(source, encoding="utf-8")
            run = subprocess.run([executable, str(path)], cwd=directory, capture_output=True,
                                 text=True, encoding="utf-8", errors="replace", timeout=timeout,
                                 env={**os.environ, "ELAN_TOOLCHAIN": LEAN_TOOLCHAIN})
        result["log"] = (run.stdout + "\n" + run.stderr)[-24000:]
        if run.returncode:
            result["checker"] = "Lean rejected the candidate"
            return result
        dependent = re.search(r"'triviality_target' depends on axioms: \[([^\]]*)\]", result["log"])
        independent = "'triviality_target' does not depend on any axioms" in result["log"]
        if not dependent and not independent:
            result["checker"] = "Lean returned no recognizable axiom audit; verification withheld"
            return result
        result["axioms"] = [s.strip() for s in dependent[1].split(",") if s.strip()] if dependent else []
        result["verified"] = set(result["axioms"]) <= ALLOWED_AXIOMS
        result["checker"] = "Lean checked the fixed theorem and axiom audit" if result["verified"] else "Disallowed axiom dependencies"
    except FileNotFoundError:
        result["checker"] = "Lean unavailable; install the pinned toolchain and set SWARM_LEAN_BIN"
    except subprocess.TimeoutExpired:
        result["checker"] = "Lean timed out; candidate remains unverified"
    except OSError as error:
        result["checker"] = f"Lean could not run: {error}"
    return result
