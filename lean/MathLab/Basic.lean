/-!
Shared definitions approved for formal targets live here. Keep this file small and
reviewed: every checked artifact is compiled against it.
-/
namespace MathLab

def IsEven (n : Nat) : Prop := ∃ k, n = 2 * k

theorem isEven_add_self (n : Nat) : IsEven (n + n) := ⟨n, by omega⟩

end MathLab
