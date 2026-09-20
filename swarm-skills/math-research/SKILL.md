---
name: triviality-math-research
version: 2.0.0
author: Triviality
description: Explore competing mathematical approaches with three independent researchers, a shared discovery bank, substantive challenges and bounded restarts.
kind: team-skill
roles:
  - id: coordinator
    purpose: Assign distinct approaches and restart abandoned branches
    skills: []
    tools: []
  - id: researcher_1
    purpose: Own the first independent investigation
    skills: []
    tools: []
  - id: researcher_2
    purpose: Own the second independent investigation
    skills: []
    tools: []
  - id: researcher_3
    purpose: Own the third independent investigation
    skills: []
    tools: []
  - id: challenger
    purpose: Test claims with substantive evidence and resolution criteria
    skills: []
    tools: []
  - id: proof_writer
    purpose: Write and repair the mathematical proof and Lean formalization
    skills: []
    tools: []
---

# Triviality exploration team

Read [workflow.md](workflow.md), [bind.md](bind.md), and [dependencies.yaml](dependencies.yaml).
Run scripts/workflow.py with WorkSwarm's swarmflow tool, preserving its sibling
exploration.py and lean_check.py. Use the executable workflow, not a rewritten approximation.

Arguments: statement; optional lean_statement (binders then colon then proposition,
no theorem name or :=); exploration_rounds (1–20); stagnation_threshold (1–6);
proof_attempts (1–6); optional literature records with stable IDs; optional role_models
mapping the six role IDs above to models. The embedded host uses catalog IDs; native
hosts use their own model IDs and budgets. Without an embedded retrieval host,
only supplied literature is searchable.

Example:

```json
{"statement":"Prove that addition preserves natural-number order.",
 "lean_statement":"(a b c : Nat) (h : a ≤ b) : a + c ≤ b + c",
 "exploration_rounds":4,"stagnation_threshold":2,"proof_attempts":2,"literature":[]}
```

Return findings, both banks, branch states and checker evidence. Preserve candidate,
blocked, formalized and verified distinctions. Only an unchanged supplied target
passing Lean may be verified; a generated target requires translation review.
Model assessments of refutation or readiness never establish mathematical truth.
