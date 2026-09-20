import Mathlib

set_option linter.style.header false
set_option linter.style.native false

/-!
# A counterexample to the proposed trihexagonal-shell bound

The cells of the trihexagonal tiling form the incidence graph of the regular
triangular lattice: lattice vertices represent hexagons and elementary
triangular faces represent triangles. This file gives a finite, checkable
certificate for a 31-cell hole with a 23-cell connected shell.
-/

namespace TrihexagonalShell

inductive Orientation
  | up
  | down
  deriving DecidableEq, Repr

structure Axial where
  q : ℤ
  r : ℤ
  deriving DecidableEq, Repr

inductive Cell
  | hex (p : Axial)
  | tri (o : Orientation) (q r : ℤ)
  deriving DecidableEq, Repr

open _root_.TrihexagonalShell.Orientation Cell

private def fs (xs : List Cell) : Finset Cell := xs.toFinset

def neighbors : Cell → Finset Cell
  | hex ⟨q, r⟩ => fs
      [tri up q r, tri up (q - 1) r, tri up q (r - 1),
       tri down (q - 1) r, tri down q (r - 1),
       tri down (q - 1) (r - 1)]
  | tri up q r => fs
      [hex ⟨q, r⟩, hex ⟨q + 1, r⟩, hex ⟨q, r + 1⟩]
  | tri down q r => fs
      [hex ⟨q + 1, r⟩, hex ⟨q, r + 1⟩, hex ⟨q + 1, r + 1⟩]

def corona (A : Finset Cell) : Finset Cell :=
  (A.biUnion neighbors) \ A

def expand (A reached : Finset Cell) : Finset Cell :=
  reached ∪ A.filter fun x => ((neighbors x) ∩ reached).Nonempty

def flood (A : Finset Cell) : ℕ → Finset Cell → Finset Cell
  | 0, reached => reached
  | k + 1, reached => flood A k (expand A reached)

def Connected (A : Finset Cell) : Prop :=
  ∃ root ∈ A, A ⊆ flood A A.card {root}

instance (A : Finset Cell) : Decidable (Connected A) := by
  unfold Connected
  infer_instance

def coreHexagons : Finset Cell := fs
  [hex ⟨0, 0⟩,
   hex ⟨1, 0⟩, hex ⟨0, 1⟩, hex ⟨-1, 0⟩,
   hex ⟨0, -1⟩, hex ⟨1, -1⟩, hex ⟨-1, 1⟩]

def hole : Finset Cell :=
  coreHexagons ∪ coreHexagons.biUnion neighbors

def boundaryHexagons : Finset Cell := fs
  [hex ⟨-2, 0⟩, hex ⟨-2, 1⟩, hex ⟨-2, 2⟩,
   hex ⟨-1, -1⟩, hex ⟨-1, 2⟩,
   hex ⟨0, -2⟩, hex ⟨0, 2⟩,
   hex ⟨1, -2⟩, hex ⟨1, 1⟩,
   hex ⟨2, -2⟩, hex ⟨2, -1⟩, hex ⟨2, 0⟩]

def bridgeTriangles : Finset Cell := fs
  [tri down (-3) 0, tri down (-3) 1,
   tri up (-2) (-1), tri up (-2) 2,
   tri up (-1) (-2), tri up (-1) 2,
   tri down 0 (-3), tri down 0 1,
   tri down 1 (-3), tri down 1 0,
   tri up 2 (-2)]

def shell : Finset Cell := boundaryHexagons ∪ bridgeTriangles

theorem hole_card : hole.card = 31 := by
  native_decide

theorem shell_card : shell.card = 23 := by
  native_decide

theorem hole_shell_disjoint : Disjoint hole shell := by
  native_decide

theorem hole_connected : Connected hole := by
  native_decide

theorem shell_connected : Connected shell := by
  native_decide

theorem corona_hole : corona hole = boundaryHexagons := by
  native_decide

theorem corona_contained_in_shell : corona hole ⊆ shell := by
  native_decide

def proposedCapacity (s : ℕ) : ℕ := (s ^ 2 + 6) / 18

theorem proposed_capacity_at_23 : proposedCapacity 23 = 29 := by
  native_decide

theorem counterexample_to_proposed_capacity :
    proposedCapacity shell.card < hole.card := by
  native_decide

end TrihexagonalShell
