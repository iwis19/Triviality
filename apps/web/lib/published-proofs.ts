import type { LiteraturePaper } from "./literature";

export const trihexagonalShellProof: LiteraturePaper = {
  id: "trihexagonal-shell",
  date: "September 20, 2026",
  category: "Verified counterexample",
  title: "Trihexagonal shell: a counterexample to the proposed bound",
  subtitle: "A connected 23-cell shell enclosing a connected 31-cell hole",
  authors: "Submitted to Triviality",
  source: "Lean 4 / Mathlib certificate",
  verification: {
    label: "Lean certificate builds successfully",
    detail: "The finite certificate and arithmetic contradiction were checked with the pinned Lean toolchain. The certificate uses native_decide; this badge describes a successful build, not the site’s stricter independent-verifier policy.",
  },
  artifacts: [
    { label: "Download Lean source", href: "/proofs/trihexagonal-shell.lean" },
  ],
  sections: [
    {
      id: "result",
      title: "Result",
      markdown: String.raw`The proposed formula says that an $s$-cell shell can enclose at most

$$
\left\lfloor\frac{s^2+6}{18}\right\rfloor
$$

cells. It is false. A compact 31-cell hole has a connected 23-cell shell, but the formula gives only 29.`,
    },
    {
      id: "coordinate-model",
      title: "Coordinate model",
      markdown: String.raw`Identify the hexagons of the trihexagonal tiling with the vertices of the triangular lattice. In axial coordinates, the elementary triangular faces are

$$
U(q,r)=\{(q,r),(q+1,r),(q,r+1)\},
$$

and

$$
D(q,r)=\{(q+1,r),(q,r+1),(q+1,r+1)\}.
$$

A triangular cell is edge-adjacent to precisely the three hexagonal cells at the vertices of its corresponding face.

Take the radius-one ball

$$
X=\{(0,0),(1,0),(0,1),(-1,0),(0,-1),(1,-1),(-1,1)\}.
$$

Let $H$ contain the seven hexagonal cells indexed by $X$ and every triangular cell incident with at least one vertex of $X$.`,
    },
    {
      id: "counting-hole",
      title: "Counting the hole",
      markdown: String.raw`Every triangular-lattice vertex belongs to six elementary faces. The subgraph induced by $X$ has 12 edges and six elementary triangular faces. By inclusion-exclusion, the number of triangular cells incident with $X$ is

$$
6|X|-2E+F=6\cdot7-2\cdot12+6=24.
$$

Thus

$$
|H|=7+24=31.
$$

The set is edge-connected: every noncentral hexagon is joined to the central hexagon through either of their two common triangular cells.`,
    },
    {
      id: "constructing-shell",
      title: "Constructing the shell",
      markdown: String.raw`Every neighbor of $H$ outside $H$ is a hexagon. In axial coordinates these are

$$
\begin{aligned}
B=\{&(-2,0),(-2,1),(-2,2),(-1,-1),(-1,2),(0,-2),\\
&(0,2),(1,-2),(1,1),(2,-2),(2,-1),(2,0)\}.
\end{aligned}
$$

So the corona has 12 cells. In their cyclic order, consecutive corona hexagons share an outward triangular neighbor. Add 11 of those 12 outward triangles, omitting one. The result $S$ is an alternating path, hence is connected, and

$$
|S|=12+11=23.
$$

The shell is disjoint from $H$, and it contains the entire corona of $H$, so no cell of $H$ is edge-connected to the exterior after $S$ is removed.

Finally, $S$ has no internal cavity. The only possible cells between $H$ and the corona are already in $H$. Each added triangle points outward. The one omitted outward triangle is incident with a hexagon beyond the corona and is therefore connected to the unbounded exterior. Cutting the outward ring at that triangle turns it into a path, so all cells outside $H \cup S$ remain in that same exterior component.

Consequently $S$ is a connected enclosing shell for the connected 31-cell hole $H$.`,
    },
    {
      id: "contradiction",
      title: "The contradiction",
      markdown: String.raw`For a shell of size 23, the proposed capacity is

$$
\left\lfloor\frac{23^2+6}{18}\right\rfloor
=\left\lfloor\frac{535}{18}\right\rfloor=29<31.
$$

This counterexample invalidates the claimed boundary optimization.`,
    },
    {
      id: "formal-verification",
      title: "Formal verification",
      markdown: String.raw`The accompanying Lean file checks every finite part of the certificate:

- the hole contains 31 cells;
- the shell contains 23 cells;
- the hole and shell are disjoint;
- both finite sets are edge-connected;
- the twelve listed boundary hexagons are exactly the hole's corona;
- that corona is contained in the shell; and
- the proposed capacity at 23 is 29, strictly below the hole size.

The principal checked declaration is:



~~~lean
theorem counterexample_to_proposed_capacity :
    proposedCapacity shell.card < hole.card := by
  native_decide
~~~

The downloadable artifact contains the complete coordinate model, adjacency relation, finite sets, and all supporting declarations.`,
    },
  ],
};
