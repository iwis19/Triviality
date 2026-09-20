---
name: triviality-math-research
version: 1.0.0
author: Triviality
description: |
  Collaboratively investigate a mathematical claim, challenge assumptions, and
  attempt a fixed Lean theorem. Use for bounded research with competing proof
  directions and independent critique. Not a guarantee of solving open problems.
kind: team-skill
roles:
  - id: coordinator
    purpose: Decompose the goal and recover failed investigations
    skills: []
    tools: []
  - id: researcher
    purpose: Investigate constructive and counterexample directions independently
    skills: []
    tools: []
  - id: critic
    purpose: Review shared evidence, identify gaps, and request revision or stop
    skills: []
    tools: []
  - id: proof-writer
    purpose: Write and repair a proof of the fixed formal statement
    skills: []
    tools: []
---

# Triviality mathematical research team

Read [workflow.md](workflow.md), [bind.md](bind.md), and
[dependencies.yaml](dependencies.yaml). Role instructions are in [roles](roles/).

Run the checked-in `scripts/workflow.py` using WorkSwarm's `swarmflow` tool.
Pass a JSON args object with `statement` (the natural-language goal), optional
`lean_statement` (binders followed by `: proposition`, no theorem name or `:=`),
`proof_attempts` (1–6), and optional `literature` records. Optional
`role_models` assigns a model to each role. Omit it to inherit the native
WorkSwarm teammate model; the embedded host defaults to the catalog default.

Use the actual script, not a rewritten approximation or independent role chats.
The script uses native `agent`, `parallel`, `phase`, and `log` primitives and
passes each colleague's findings into the next decision. It calls the bundled
Lean checker as a local tool, so preserve `scripts/lean_check.py` beside it.

Example args:

```json
{
  "statement": "Prove that adding the same natural number preserves an inequality. Check the assumptions independently.",
  "lean_statement": "(a b c : Nat) (h : a ≤ b) : a + c ≤ b + c",
  "proof_attempts": 2,
  "literature": []
}
```

Return the workflow result verbatim alongside a short explanation. Preserve
`blocked`, `candidate`, `formalized`, and `verified` distinctions. A generated
statement that passes Lean is `formalized`; only an unchanged user-supplied
formal target can yield `verified`. All claims remain conditional on the
formal statement's assumptions and its correspondence to the user's intent.

Missing Lean is a supported degraded mode: return findings and an unverified
candidate. Missing model access prevents live collaboration. Never label a
fixture test as a live model run.

The embedded Triviality host always uses WorkSwarm. Its optional `role_models`
argument maps `coordinator`, `researcher`, `challenger`, `critic`, and
`proof_writer` to IDs from `config/research-models.json`. In a native host,
use model IDs recognized by that host instead of Triviality catalog aliases.
