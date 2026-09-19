import shutil
from pathlib import Path

import pytest

from app.services.lean_checker import LeanChecker

LEAN_DIR = Path(__file__).resolve().parents[2] / "lean"
lean_available = shutil.which("lake") is not None and LEAN_DIR.exists()

NAME = "two_plus_two"
SIG = ": 2 + 2 = 4"
DECL = f"theorem {NAME} {SIG}"


def test_static_rejects_sorry_and_axioms() -> None:
    reasons = LeanChecker(None).static_reject_reasons(
        f"axiom bad : False\n{DECL} := by sorry", NAME, SIG
    )
    assert any("axiom" in r for r in reasons)
    assert any("sorry" in r for r in reasons)


def test_static_rejects_changed_or_missing_target() -> None:
    checker = LeanChecker(None)
    weakened = f"theorem {NAME} : 2 + 2 = 4 ∨ True := Or.inr trivial"
    assert any(
        "differs from approved target" in r
        for r in checker.static_reject_reasons(weakened, NAME, SIG)
    )
    renamed = "theorem other : 2 + 2 = 4 := rfl"
    assert any("not found" in r for r in checker.static_reject_reasons(renamed, NAME, SIG))
    assert checker.static_reject_reasons(f"{DECL} := rfl", NAME, SIG) == []


def test_unavailable_checker_reports_blocker() -> None:
    result = LeanChecker(Path("/nonexistent/lean-project")).check(f"{DECL} := rfl", NAME, SIG)
    assert result.status == "checker_unavailable"


@pytest.mark.skipif(not lean_available, reason="lake/lean not installed")
def test_real_lean_verifies_and_rejects() -> None:
    checker = LeanChecker(LEAN_DIR, timeout_seconds=600)
    ok = checker.check(f"import MathLab.Basic\n{DECL} := rfl", NAME, SIG)
    assert ok.status == "verified", ok.reasons + [ok.log[-500:]]
    assert ok.axioms == []
    assert ok.toolchain.startswith("Lean")

    fails = checker.check(
        f"import MathLab.Basic\ntheorem {NAME} : 2 + 2 = 5 := rfl", NAME, ": 2 + 2 = 5"
    )
    assert fails.status == "rejected"

    # uses the shared approved definitions file
    shared = checker.check(
        "import MathLab.Basic\ntheorem four_even : MathLab.IsEven 4 := ⟨2, rfl⟩",
        "four_even",
        ": MathLab.IsEven 4",
    )
    assert shared.status == "verified", shared.reasons + [shared.log[-500:]]
