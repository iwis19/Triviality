# Devin Math Discovery Lab

## Research and implementation plan

Prepared for Sharon · Research checked September 19, 2026

**Recommendation:** Build a persistent mathematical research system around Devin: a versioned graph of hypotheses, experiments, proof attempts, and verified results; a budgeted search controller that continually allocates effort; and a 3D interface for understanding and steering the exploration.

**Confirmed scope:** Explore broadly across mathematics, branch into areas and subfields, and build a growing map of unsolved problems. Each problem can launch its own branching research campaign. The map connects those campaigns through shared methods, results, and explicit mathematical relationships.

**Confirmed sharing model:** Anyone can browse the published map and research. Only Sharon and invited collaborators can edit records, steer Devin, launch investigations, or spend the research budget.

**Confirmed proof goal:** Explore problems through both informal reasoning and formal methods. Propose and publish clearly labelled informal proof candidates while working toward independently checked Lean proofs as the end goal.

**Confirmed publication policy:** Public-facing map and research updates publish automatically, including informal proof proposals and verification results, with clear evidence and verification labels. No manual publication approval is required.

**Confirmed Devin access:** Use Sharon's existing Max plan, with API-created research sessions attributed to Sharon. Devin handles all initial AI research work; separate model-provider accounts and APIs are not required. A new monetary budget is not an outstanding planning decision.

**Confirmed mode strategy:** Compare Fusion with Ultra in the initial pilot and keep both selectable per research assignment. Choose subsequent defaults from checked mathematical results rather than assume either mode is superior.

Use existing evolution and proof tools behind replaceable adapters. The most valuable custom work is the connection between **exploration, trustworthy evidence, long-term memory, and human control**.

This plan is based on primary project documentation, repositories, and research papers. Repository capabilities below are documented capabilities, not results reproduced during this planning session. License labels are an initial screen, not a dependency audit. No system has been implemented or benchmarked here.

---

## 1. Product definition and initial scope

The product should let a researcher:

1. Explore a broad atlas of mathematics, expanding areas into subfields and sourced open problems.
2. Inspect each problem's exact assumptions, known results, references, status history, and connections to other areas.
3. Allocate a shared research budget across the map, with bounded campaigns for selected problems.
4. Generate competing approaches: auxiliary lemmas, constructions, counterexample searches, reformulations, and proof sketches.
5. Explore those approaches with Devin, symbolic computation, and proof assistants.
6. Periodically promote promising branches, preserve diverse alternatives, and stop spending on exhausted approaches.
7. Recombine useful ideas across problems and areas, subject to checking their assumptions.
8. Watch the map and research branches grow in 3D, inspect evidence, and redirect effort.
9. Export a reproducible result package when a candidate proof or counterexample emerges.
10. Automatically publish map and research updates with their evidence labels, while keeping research controls available only to authorized collaborators.

“Continually” should mean an enduring, resumable research campaign with explicit budgets and stopping conditions. The campaign survives individual Devin sessions, workers, and application restarts.

### Broad mathematical atlas

Start with broad coverage rather than committing the product to one field. Use these provisional navigation groups, refining them as sources and research accumulate:

| Area | Examples of branches |
|---|---|
| Algebra | Groups, rings, representation theory, category theory |
| Number theory | Analytic, algebraic, arithmetic geometry, Diophantine problems |
| Geometry and topology | Differential and algebraic geometry, manifolds, knot theory |
| Analysis | Functional and harmonic analysis, differential equations, dynamics |
| Combinatorics and discrete mathematics | Graphs, extremal problems, discrete structures |
| Probability and statistics | Stochastic processes, probabilistic structures, inference |
| Logic and foundations | Set theory, model theory, computability, proof theory |
| Optimization and applied mathematics | Numerical methods, control, variational problems |
| Theoretical computer science | Complexity, algorithms, mathematical aspects of computation |

These groups are a proposed interface, not a canonical partition. A problem may belong to several areas. Arithmetic geometry, for example, should be reachable through both number theory and geometry without duplicating the problem or its evidence.

The basic navigation is:

```text
Mathematics
  → areas
    → subfields
      → sourced open problems
        → competing approaches
          → conjectures, experiments, lemmas, proof attempts
```

This is a browsing hierarchy over a graph. Area membership is classification, while the branches beneath a problem record research lineage. Cross-area connections remain visible without pretending every problem has a single parent.

Support two activities from the first prototype: expanding the atlas and investigating problems already in it. A practical first seed is 27–45 distinct source-backed problems spanning all nine groups, with at least three per group, followed by continuous expansion. That is a proposed starting inventory, not a collection already researched or an assertion of complete coverage. Display empty, unreviewed, and stale regions explicitly.

Run a small number of deep investigations at a time across different areas and rotate them under a shared budget. Limited worker concurrency must not turn the product into a graph-theory-only system. Literature review, precise reformulation, and dependency mapping remain useful work in domains without cheap numerical tests or convenient formal libraries.

### Research activities within each area

Use three kinds of tasks, with evaluators chosen for the mathematics involved:

| Track | Typical work | What counts as success |
|---|---|---|
| Construction discovery | Find a graph, set, arrangement, or algorithm satisfying exact constraints | An independently checked witness or improved bound |
| Conjecture exploration | Propose relationships among invariants; strengthen or repair statements | A precise conjecture with reproducible evidence, or a checked counterexample |
| Proof discovery | Find and compose lemmas that imply a fixed target theorem | Informal candidates are intermediate progress; the goal is an independently checked Lean proof of the approved statement |

Support informal and formal exploration from the start, including problems that do not yet have a convenient Lean representation. Preserve useful informal arguments as clearly labelled candidates and formalize promising statements and proof attempts progressively. Human review can improve a candidate and assess its significance; it does not replace the Lean proof goal. Speculative thoughts do not each need a formalization.

### Planning assumptions

- A single researcher or small invited team operates the lab; the published atlas is publicly browsable.
- Use Devin sessions under Sharon's existing Max plan for AI work; no separate hosted-model account or dedicated GPU is assumed.
- Lean 4 is the target for final formal proof artifacts.
- Admission to the atlas does not require a Lean formalization or an executable evaluator; record tool and verification coverage per problem.
- Human review determines the intended problem statement and assesses novelty.
- Broad exploration is confirmed; detailed area groupings and scheduling shares remain configurable.
- The initial target is a working research tool and a trustworthy pilot, rather than a scheduled breakthrough on a famous conjecture.

Scope, sharing, automatic public updates, the Lean proof goal, and use of Sharon's Max plan are confirmed. Section 15 records those decisions and the default approach to mathematical review.

---

## 2. Existing projects worth using

There are substantial components of this idea already online, including projects surprisingly close to the proposed proof evolution and graph interface. I did not establish that any one project provides the complete, validated product described here.

### 2.1 Closest conceptual matches

| Project | Relevant documented capability | Recommended use and limitations |
|---|---|---|
| [Mathematical Discovery Engine](https://github.com/ansumandas441/mathematical-discovery-engine) | Describes a mathematical knowledge graph, an LLM orchestrator, parallel workers, pruning, and an interactive 3D graph. MIT. | Closest overall product overlap found. Inspect its graph UX, schemas, and orchestration before building equivalents. Its README's claims about discovery and a finite, tractable search space are not evidence of sound proofs or general research capability. Do not import its knowledge graph as trusted mathematics without checking provenance. |
| [lean_evolve](https://github.com/Slim205/lean_evolve) | Evolves Lean proof sketches across islands; decomposes targets into lemmas; uses a sub-prover, reviewer, mutator, and call budget. Apache-2.0. | Closest match to the proposed proof generations. Useful reference and benchmark candidate. Its README documents a hard-coded problem entry point and external sibling verifier/inference dependencies, so it is not a turnkey foundation. Its “fraction of lemmas solved” fitness is vulnerable to rewarding easy decompositions; use stronger selection criteria. |
| [TreeThink](https://github.com/GGLAB-KU/treethink) | Modular mathematical tree search with policies, evaluators, and proof-assistant clients; documents a Lean/Kimina integration. MIT. | Evaluate as a proof-search adapter. Potentially saves search-policy infrastructure. Its focus is proving a supplied target, while this product also needs conjecture generation, persistent campaigns, novelty tracking, and a research UI. |

**Decision:** Run a small compatibility spike on these projects before adopting code. Prefer a thin adapter over a deep fork. Preserve control of the application's data model and verification rules.

### 2.2 Evolutionary discovery and conjecture generators

| Project | What it provides | Fit and availability |
|---|---|---|
| [OpenEvolve](https://github.com/algorithmicsuperintelligence/openevolve) | LLM-driven program evolution, quality-diversity archives, islands, ensembles, and evaluator feedback. | First candidate to evaluate for executable constructions. Apache-2.0. Adopt only if a compatibility spike can route proposal work through bounded Devin sessions; otherwise reuse its search methods in the application controller. It does not supply the mathematical proof standard or full hypothesis graph. |
| [ShinkaEvolve](https://github.com/SakanaAI/ShinkaEvolve) | Program evolution with parent sampling, population archives, parallel evaluation, and local/Slurm execution. | Alternative to benchmark against OpenEvolve. Apache-2.0. Apply the same Devin-adapter requirement; neither engine is a prerequisite for the initial build. |
| [FunSearch](https://github.com/google-deepmind/funsearch) | Original research implementation, example constructions, and evaluators. | Excellent baseline and source of problem adapters. Code Apache-2.0; other materials CC-BY-4.0. The repository explicitly excludes the language models, sandbox, and distributed infrastructure. |
| [AlphaEvolve results](https://github.com/google-deepmind/alphaevolve_results) and [problem repository](https://github.com/google-deepmind/alphaevolve_repository_of_problems) | Result notebooks, verification code, prompts, initial programs, and problem descriptions. | Valuable evaluation material. The repositories explicitly do **not** contain the AlphaEvolve engine. Code Apache-2.0; other materials CC-BY-4.0. Check each problem's current status before treating it as open. |
| [PatternBoost](https://github.com/zawagner22/transformers_math_experiments) | Alternates classical local search with a transformer trained on successful constructions. | A good later option for domains with many cheap examples. It adds training and Python/Julia infrastructure; unnecessary for the first Devin-based prototype. Reuse permissions were not established from the fetched README. |
| [TxGraffiti2](https://github.com/RandyRDavila/TxGraffiti2) | Generates symbolic conjectures from structured data, filters them with heuristics, and documents counterexample search and Lean export. | A useful non-LLM hypothesis source, especially for graph invariants. MIT. Exporting a Lean statement does not prove it. |
| [Conjecturing for Sage](https://nvcleemp.github.io/conjecturing/) | Dalmatian-style conjecture generation using objects, invariants, and property relations. | Useful baseline and method reference. Older Sage/C integration may need adaptation; license and current compatibility need checking before copying code. |

### 2.3 Mathematical reasoning and proof infrastructure

| Project | Recommended role | Important boundary |
|---|---|---|
| [Lean 4 / mathlib](https://github.com/leanprover-community/mathlib4) | Formal statements, reusable theorems, proof checking. mathlib is Apache-2.0. | A proof validates a particular formal statement under its dependencies. It does not by itself establish that the statement matches the intended open problem or is novel. |
| [LeanInteract](https://github.com/augustepoiroux/LeanInteract) | First Python-to-Lean adapter for whole-file checking and feedback. MIT. | Start with full proof checking. Its README labels tactic-mode interaction experimental; evaluate it before building an interactive tactic search around it. |
| [PyPantograph](https://github.com/stanford-centaur/PyPantograph) | Programmatic tactic execution, proof-state interaction, and environment inspection. Apache-2.0. | Candidate for more sophisticated tactic-level search. Pin compatible Lean, mathlib, and adapter revisions. |
| [LeanDojo-v2](https://github.com/lean-dojo/LeanDojo-v2) | Repository tracing, retrieval, training, and proving infrastructure. Apache-2.0. | Useful when retrieval or model training becomes a measured bottleneck. More infrastructure than the initial checker needs. Original LeanDojo is a separate MIT-licensed project. |
| [DeepSeek-Prover-V2](https://github.com/deepseek-ai/DeepSeek-Prover-V2) | Released Lean prover models and subgoal-decomposition research. | Candidate prover backend or baseline. Hosting requirements depend heavily on model size; the repository points to a model-specific license, so do not assume MIT model rights. |
| [Aristotle SDK](https://pypi.org/project/aristotlelib/) | Hosted formal reasoning through an official Python SDK and API. | Optional prover/formalization backend. Requires access and an API key; verify current service terms, data handling, supported Lean versions, quotas, and pricing. Independently recheck returned artifacts. |

### 2.4 Research-agent patterns and visualization

- **[Aletheia](https://arxiv.org/html/2602.10177v1)** is highly relevant: its paper describes a generator, natural-language verifier, and reviser for mathematical research. The public [Aletheia directory](https://github.com/google-deepmind/superhuman/tree/main/aletheia) provides prompts and responses. The materials inspected do not establish an installable release of the full research agent. Reuse evaluation and critique patterns, and keep natural-language review distinct from formal checking.
- **[AI Scientist-v2](https://github.com/SakanaAI/AI-Scientist-v2)** offers agentic experiment-tree ideas. It targets empirical scientific research and has a custom source license with disclosure requirements. It is a design reference rather than the default foundation for a mathematical proof system.
- **[react-force-graph](https://github.com/vasturiano/react-force-graph)** and **[3d-force-graph](https://github.com/vasturiano/3d-force-graph)** provide React bindings and Three.js/WebGL graph rendering under MIT licenses. These are the recommended visualization components. Build the mathematical interactions around them rather than writing a graph renderer.

### 2.5 What the research implies

The strongest demonstrated fit for evolutionary systems is often a problem with an executable candidate and a useful evaluator. Natural-language proof ideas have much weaker automatic fitness signals.

A particularly relevant [OpenEvolve bijection study](https://arxiv.org/html/2511.20987v1) reports mixed results, including a task where a directly prompted model found a known solution while the evolutionary setup failed. Therefore, the project should test whether evolution improves outcomes at a fixed budget; it should not assume more branches or generations automatically produce better mathematics.

### 2.6 Sources for the map of unsolved mathematics

The atlas needs sources for its classification and problem inventory in addition to search engines:

| Source | Documented material | Proposed use and limitation |
|---|---|---|
| [Mathematics Subject Classification 2020](https://msc2020.org/) | A taxonomy maintained jointly by Mathematical Reviews and zbMATH; downloadable PDF, TeX, and CSV. The official page states CC-BY-NC-SA licensing. | Reference for classification and external identifiers. Use independently authored navigation labels initially; review licensing before distributing or adapting the taxonomy, especially for commercial use. MSC classifies mathematics, not which problems remain open. |
| [American Institute of Mathematics problem lists](https://aimath.org/problemlists/) | Links to problem lists across algebra, geometry, analysis, number theory, topology, and other subjects, in several formats. | High-value starting points for breadth and specialist questions. Preserve the source and publication date; check later literature rather than assuming an older list is current. No uniform ingestion API was established in this research. |
| [Open Problem Garden](https://www.openproblemgarden.org/) and its [area index](https://www.openproblemgarden.org/container/area) | Community-maintained problems organized by area, topic, and subtopic; the index links to a separate solved-problem section. | Useful product reference and a source of leads. The inspected index also contained unrelated spam entries, so filter and review candidates before admission. Bulk-reuse rights were not established. |
| [Erdős Problems](https://www.erdosproblems.com/faq) | A focused source for one important collection of problems and status information. | One input to a broad atlas, not the whole inventory. Follow its advice to search the literature; avoid letting its convenient coverage dominate the map. |
| Original papers, surveys, and specialist workshop lists | Statements, conjectures, partial results, and later resolutions in their mathematical context. | Follow references from curated sources and record exact locations. Access, formats, and reuse permissions vary by source. |

Start with a small reviewed import from several sources. Build source adapters that produce candidate records, not automatic assertions of truth or open status. Store source URLs, attribution, dates, identifiers, and permitted excerpts; retain full documents only where permitted. Public access alone does not establish permission for bulk redistribution.

The result should be described as a **growing, sourced atlas of known open problems**. No source inspected establishes a complete inventory of all unsolved mathematics.

---

## 3. Build-versus-reuse decision

### Build as the core product

- A broad mathematical atlas, source intake, classification, and problem-status history.
- A portfolio scheduler that balances atlas expansion, subject coverage, and individual research campaigns.
- A typed, versioned research graph with provenance and evidence.
- A persistent campaign controller with budgets and reproducible selection decisions.
- The mapping from informal claims to formal statements and proof obligations.
- An experiment/evidence registry and independent verification pipeline.
- The 3D research interface, branch comparison, timeline, and human steering.
- Public browsing of published records, private research controls, and versioned publication permissions.
- A Devin-facing tool API and worker result contract.

### Reuse behind adapters

- OpenEvolve or ShinkaEvolve only after verifying compatibility with Devin-driven proposal generation; initially the application owns the evolution loop.
- Lean, mathlib, and LeanInteract for the initial proof-checking lane.
- A proof-search adapter selected after the TreeThink / lean_evolve compatibility spike, without making separate model access a prerequisite.
- Devin sessions for proposal generation, critique, investigation, and formalization. Hosted specialist provers remain optional future experiments.
- react-force-graph-3d for rendering.
- Python mathematical libraries such as SymPy and NetworkX where sufficient; SageMath as a separate optional worker image for domains requiring it.

Keep **one application-level budget and campaign state machine**. An embedded evolutionary engine receives a bounded sub-budget and returns events/artifacts. It must not launch an uncontrolled second campaign loop.

Do not train a new foundation model in the MVP. Collect useful trajectories first; model adaptation becomes a later experiment.

---

## 4. Representing ideas correctly

An idea needs more structure than a chat message or a point in space.

### 4.1 Main entities

| Entity | Key fields |
|---|---|
| `Atlas` | Versioned area structure, coverage summaries, source-adapter configuration |
| `Area` | Name, parent/subfield links, aliases, optional external classification identifiers |
| `Source` | URL, bibliographic identifiers, authors, publication/retrieval dates, reuse policy |
| `SourceAssertion` | Source and exact location, cited problem version, asserted status or relationship, review state |
| `Problem` | Exact statement, definitions, assumptions, multiple area memberships, references, origin, status history and date checked, approved formal target if available |
| `ResearchPortfolio` | Atlas, campaign set, shared budget, area-allocation policy, discovery frontier, checkpoints |
| `Campaign` | Portfolio, problem version, policy version, seed, sub-budget, state, checkpoints, model/tool versions |
| `Claim` | Informal statement, quantifiers and scope, optional Lean declaration, content hash, version, source |
| `Idea` | Proposed approach, parent ideas, claims addressed, mechanism, next experiment, estimated cost, novelty rationale |
| `Attempt` | Assigned worker, requested/reported Devin mode, available model metadata, input context hash, action, timestamps, output artifacts, usage, execution status |
| `Evidence` | Claim version, check type, coverage, result, verifier version, certificate/log/artifact references |
| `SelectionDecision` | Candidate set, score components, diversity cluster, promotion/archive reason, policy version |
| `Artifact` | Content hash, storage URI, producer, environment and dependency manifest |
| `Relation` | Typed source/target connection with provenance and confidence where appropriate |
| `Publication` | Eligible record/artifact versions, public fields and relations, publication-policy version, originating event, publication/withdrawal time, public revision |

An idea can propose several claims, and multiple ideas can target the same claim. A successful proof attempt can rely on many lemmas.

A source's claim that a problem is open is a dated assertion with provenance. It is not equivalent to a verified proof that no solution exists. Generated conjectures have `origin = generated`; literature-sourced problems retain their original attribution.

### 4.2 Four graph layers

1. **Atlas structure:** “subfield of” and “classified in,” connecting areas, subfields, and canonical problem records. Maintain an acyclic browsing hierarchy and allow multiple memberships.
2. **Lineage:** “derived from,” “refined from,” “combined from.” This is an acyclic graph over immutable idea versions. Multiple parents are allowed.
3. **Mathematical dependencies:** “requires lemma,” “proves,” “contradicts,” “specializes.” Represent a proof attempt as a node requiring all its premises, so an AND dependency is not mistaken for a choice between alternatives.
4. **Associations:** “similar to,” “uses technique,” “cites.” These may contain cycles and do not imply logical entailment.

The display can overlay all four, but they must remain distinct in storage and in the legend. A model-suggested equivalence or implication remains a proposed relation until supported by a checked argument; thematic similarity is never enough.

### 4.3 Keep independent status dimensions

- **Execution:** queued, running, completed, failed, timed out, cancelled.
- **Scheduling:** active, promoted, archived, pinned.
- **Evidence:** untested, empirically supported, counterexample checked, proof sketch, informal proof candidate, Lean proof verified, unresolved conflict.
- **Review:** unreviewed, AI-critiqued, expert-reviewed, disputed; record the reviewer and exact artifact version. AI critique is not expert review.
- **Novelty:** unchecked, known result, potentially new, expert-reviewed novelty.
- **Formalization:** absent, target proposed, target approved, queued, in progress, blocked, complete, superseded.
- **Problem status:** unreviewed, reported open, resolution claimed, resolved after review, disputed, unknown.
- **Coverage:** source coverage, date of literature review, available evaluators, formal-library support, and expert-review availability.
- **Publication:** private, queued for automatic publication, published version, withheld with reason, withdrawn version. Publication is separate from mathematical verification.

Do not collapse these into one “confidence” number. A formal proof can be old; a new idea can be false; an archived idea can still be mathematically valid.

### 4.4 Immutability and failure propagation

Changing assumptions creates a new claim version. A proof certificate for one statement cannot silently transfer to the revised statement.

A counterexample invalidates the exact claim it contradicts. Dependency edges identify downstream results needing re-evaluation. Mere descent from a failed idea does not invalidate a repaired child with different assumptions.

Record failures narrowly: “this prover did not solve this version within this budget.” Do not cache a timeout as permanent evidence that a theorem is false.

If later literature resolves a problem, append a sourced status event, retain its historical branches, and suspend new solve attempts pending review. A reported resolution and an independently checked formal proof remain separate facts. A generated conjecture only enters the literature-facing atlas as a clearly labelled proposal after a precise statement and novelty review.

---

## 5. The search loop

### 5.1 Atlas expansion and problem intake

Maintain an outer discovery loop:

1. Choose an under-covered area or a region whose sources are due for review.
2. Follow curated lists, surveys, and references to candidate problems and subfields.
3. Extract precise statements, original attribution, assumptions, source locations, and the date and basis of any open-status claim.
4. Check candidate duplicates by identifiers and statement structure; route possible equivalences for review rather than merging on embedding similarity.
5. Admit reviewed records, with multiple area memberships where useful. Quarantine unsupported, malformed, or irrelevant entries.
6. Link known results, obstacles, techniques, and nearby problems; keep inferred relationships visibly provisional.
7. Refresh status on a configurable schedule and when new relevant literature appears.

Do not fill empty parts of the map with invented “known open problems.” The generator may propose new conjectures, but those carry different provenance. Persist discovery jobs and source-review checkpoints just like proof jobs.

Before spending heavily:

1. Normalize the statement and ask the researcher to resolve ambiguities.
2. Retrieve original sources and relevant known results; record the date of the open-status check.
3. Identify useful representations, tractable special cases, and available verifiers.
4. Produce a “problem card” with possible progress measures and known obstructions.
5. Create initial approaches from several method families.

Problem directories such as [Erdős Problems](https://www.erdosproblems.com/faq) are useful starting points, but the site's own FAQ recommends literature searches rather than assuming every status is complete.

The portfolio controller then chooses bounded investigations across the atlas. Use rotating opportunities for all admitted areas and protected exploration budgets, subject to available sources and workers. Start with comparable area allocations; change them through recorded decisions using field-appropriate progress, cost, and researcher priorities. Missing tools create an explicit coverage gap, not a judgment that a field is unpromising.

### 5.2 Generate hypotheses and actions

Use several operators rather than repeatedly asking “find a proof”:

- Specialize to a finite or structured subclass.
- Strengthen an inductive invariant.
- Generalize an observed construction.
- Introduce an intermediate lemma or equivalent formulation.
- Search for an extremal object or counterexample.
- Transfer a technique from a related problem.
- Combine compatible lemmas from different branches.
- Repair a falsified conjecture by proposing meaningful extra assumptions.
- Simplify a construction or proof.

Each output must specify **what claim or obstacle it addresses, why it could help, and what next check could change our assessment**.

Use both Devin-generated proposals and classical generators, such as TxGraffiti, when the domain supports them. Distinct proposal methods can provide more diversity than different personas using the same prompt.

### 5.3 Evaluate in stages

Run inexpensive checks before costly reasoning:

1. Schema, scope, exact duplicates, and obvious contradictions.
2. Known-result retrieval and assumption comparison.
3. Small examples, randomized tests, symbolic simplification, or bounded counterexample search.
4. Targeted Devin investigation or a separate Devin critique assignment.
5. Proof search and formalization for promising candidates.
6. Independent replay of a candidate proof or witness.

Every result is labelled with its scope. Exhaustively checking all graphs up to a stated size is evidence for that finite range, not a proof about all graphs.

### 5.4 Select without destroying diversity

Use an **asynchronous, quality-diversity search**:

- Workers finish independently; the scheduler does not wait for the slowest proof.
- At a completed-attempt threshold or time interval, create a selection snapshot.
- Compare candidates within relevant problem/method categories.
- Promote evidence-backed progress while reserving effort for alternatives.
- Archive unproductive approaches with reasons; retain their artifacts and allow reactivation.

Suggested initial allocation, to be tuned experimentally:

These shares apply to research work inside a selected problem. The outer portfolio separately funds mapping, distributes work across areas, and reserves verification capacity.

| Allocation | Purpose |
|---|---|
| 50% | Develop the strongest current approaches |
| 25% | Explore distinct method families or underexplored branches |
| 15% | Try fresh approaches from the original problem |
| 10% | Revisit archived ideas after new lemmas, tools, or evidence arrive |

Use these as configurable scheduling shares, not claims of an optimal policy.

Store a score vector: verified progress, relevance to the root problem, novelty of mechanism, diversity, estimated cost, and unresolved risks. A Pareto frontier can preserve candidates with different strengths. A scalar priority may order work within a category, but must not masquerade as a calibrated probability of success.

Do not rank every field with one global fitness number. Count meaningful milestones within each problem: for example, an exact construction, a checked special case, a useful reduction, or a reviewed gap in an argument. Report the evidence tier alongside the milestone. A thousand cheap experiments must not automatically outrank one useful theoretical reduction.

In particular, **“eight of ten sublemmas proved” is not automatically better than “one of two proved.”** The unsolved obligation may contain the whole difficulty. Reward useful, independently checked lemmas and reduced difficulty of the remaining obligation, with human calibration.

### 5.5 Recombine carefully

Before combining branches, check that definitions, assumptions, and versions are compatible. Create an explicit composition attempt showing how the premises imply the target. Let formal checking validate the assembled theorem where possible.

Apply the same rule across areas. Retrieval can suggest a transfer of technique between distant regions of the map; a bounded transfer attempt must state the required correspondence and its obligations before creating a certified dependency.

### 5.6 Recover from stagnation

If no meaningful improvement appears after a configured window:

- Change the representation or method family.
- Search for counterexamples to challenge the current premise.
- Increase retrieval effort.
- Explore a smaller special case.
- Reallocate budget to another problem.
- Ask for a focused mathematical decision when a specific ambiguity blocks progress.

No timeout or stagnant campaign should be reported as “unsolvable.”

### 5.7 Portfolio and campaign pseudocode

```text
restore atlas, discovery frontier, portfolio budgets, campaign checkpoints

while portfolio is active:
    reconcile mapping jobs, campaign jobs, and shared cost reservations
    ingest reviewed problem records and dated status updates
    choose eligible area using coverage, rotation, and portfolio policy
    choose mapping, status refresh, or bounded research work
    reserve from the shared budget before dispatch
    persist decisions and publish atlas/campaign events

# Each research campaign advances in bounded scheduling steps:
restore campaign, immutable inputs, frontier, budget reservations

while campaign is active:
    reconcile running jobs and ingest validated results
    verify new evidence; update affected dependencies

    if selection is due:
        snapshot scores, method diversity, costs, and rationale
        promote / archive / reactivate approaches

    if stop condition holds:
        persist checkpoint and stop issuing work
        reconcile or cancel in-flight work according to policy
        break

    reserve budget and claim the next eligible action
    dispatch a bounded worker or bounded evolution/proof-search job
    append events and publish graph updates
```

Stop conditions include user pause, budget exhaustion, a configured no-progress threshold, unavailable dependencies, and an independently verified target result ready for review.

An informal proof proposal is an intermediate milestone: enqueue or update its formalization work rather than declaring the proof campaign solved. A budget pause may leave that work pending. Keep a checked finite witness or other useful result recorded under its own evidence type.

The loops share one transactional usage and allocation ledger. Campaign loops cannot launch independent work outside their allocations. A local campaign may finish while the portfolio continues elsewhere; a global pause, account limit, or exhausted optional portfolio cap stops dispatch across every area. For the selected Max-plan setup, budgets represent available capacity and relative effort allocations; no additional monetary cap must be chosen before proceeding. Culling archives research branches and reallocates effort, while preserving the atlas's problem records and status history.

---

## 6. What counts as mathematical evidence

### 6.1 Evidence levels

| Result | Permitted conclusion |
|---|---|
| LLM endorsement or critique | A heuristic judgment worth investigating |
| Numerical or symbolic experiment | Evidence under the tested assumptions and computation |
| Checked finite witness | The corresponding existential claim or counterexample, within the checker's scope |
| Complete informal argument | An informal proof candidate, explicitly not formally verified; eligible for critique, review, publication, and Lean formalization |
| Expert-reviewed informal argument | A reviewed candidate with recorded reviewers and scope; the Lean goal remains outstanding |
| Independently checked Lean proof | The specified formal theorem follows under the recorded trusted foundations |
| Literature and expert review | Assessment of originality, significance, and match to the intended problem |

Disproof can be a productive outcome. A checked counterexample to a genuinely open conjecture may be as valuable as a proof.

### 6.2 Formal verification pipeline

Follow Lean's official [proof-validation guidance](https://lean-lang.org/doc/reference/latest/ValidatingProofs/):

1. Approve and freeze the target theorem and relevant definitions independently of the proof-producing worker.
2. Pin the Lean toolchain, mathlib commit, allowed imports, and checker configuration.
3. Build from source in a fresh isolated environment; do not accept worker-supplied compiled artifacts as authoritative.
4. Inspect transitive axiom dependencies. For the strict initial policy, permit only the standard foundations `propext`, `Classical.choice`, and `Quot.sound`.
5. Reject `sorryAx`, undeclared assumptions, and unapproved custom axioms. A warning-free build alone is insufficient.
6. Recheck accepted proof artifacts with `lean4checker --fresh` where supported by the pinned environment.
7. For headline results, use a trusted challenge and a compatible comparator/external checker where available, in addition to mathematical review.

Native computation tactics can expand the trusted base; their exact axiom handling varies with Lean version. Exclude them from the strict initial acceptance policy unless explicitly supported and labelled under a separate verification policy.

Proof sketches may contain placeholders during search, but must remain visibly incomplete. The final Lean proof milestone requires closing every obligation and validating the actual approved root theorem. Neither informal publication nor expert review alone reaches this milestone.

Start Lean work where the required definitions and libraries are practical, and track missing infrastructure elsewhere as formalization tasks. Across the broad atlas, preserve informal arguments and other checkable certificates under their own evidence labels while keeping Lean as the proof goal. Missing formal libraries must not exclude a problem from exploration. In logic and foundations, record the ambient axiom system: an independence or relative-consistency result has a different target from a proof in the strict initial Lean policy.

### 6.3 Protect the evaluator

Generated experiment code runs with resource limits in disposable containers or stronger isolation when needed. Evaluators, final test cases, proof targets, and campaign budgets are controlled by the application, not writable by a research worker.

Separate the network-enabled literature worker from code evaluation. Give each worker only the campaign artifacts and tool access it needs.

If two checkers disagree, mark an unresolved conflict and stop automatic promotion of that evidence.

### 6.4 Novelty is a separate process

Before labelling a result potentially new:

- Search exact statements, equivalent formulations, names, and special cases.
- Retrieve original sources and verify cited theorems' assumptions.
- Track whether the result is a known theorem, a new proof, a stronger bound, a new construction, or an apparently new theorem.
- Preserve queries, retrieved passages, URLs, and access dates.
- Have a domain expert review serious candidates.

A similarity score cannot establish novelty. A model failing to recall a result is not evidence that it is unknown.

### 6.5 From informal proposals to Lean proofs

Support both direct Lean proof search and a route from informal discovery into formalization. For a promising informal candidate:

1. Preserve its exact claim, argument, assumptions, citations, unresolved gaps, and review history.
2. Prepare a Lean target and have its correspondence to the intended mathematical statement checked independently of the proof-producing worker.
3. Map the argument into definitions and lemma obligations, identifying existing mathlib results and missing library work.
4. Create bounded formalization attempts for those obligations, retaining links back to the informal argument.
5. Feed failed checks and discovered gaps back into exploration. Changed assumptions create a new claim version; never silently weaken the target to obtain a passing proof.
6. Assemble the root theorem and run the independent verification pipeline before marking that claim version **Lean verified**.

Every serious candidate should have a recorded next formalization step or a concrete blocker, such as a missing definition, unresolved mathematical gap, or insufficient budget. The scheduler reserves effort for this work alongside new exploration. A blocked candidate remains useful and visible; it is not treated as false or complete.

Use prominent public labels such as **Informal proof candidate — not formally verified**, **Lean formalization in progress**, and **Lean verified**. Show human-review status separately. An unreviewed candidate can be proposed or published under the selected publication policy without implying expert endorsement. Keep problem status and novelty separate: another mathematician's published resolution can change the atlas's literature status even if this system has not reproduced it in Lean.

---

## 7. Architecture and Devin integration

### 7.1 Recommended stack

| Layer | Initial choice | Why |
|---|---|---|
| Web UI | React + TypeScript + Vite | Straightforward interactive application |
| 3D graph | react-force-graph-3d | Existing WebGL graph renderer |
| Application API | Python + FastAPI + typed schemas | Fits mathematical and agent libraries |
| System of record | PostgreSQL | Transactions, job state, graph relations, provenance |
| Retrieval | PostgreSQL full-text search; add pgvector if useful | Start with citations and exact lookup; add semantic retrieval where it helps |
| Artifacts | Local content-addressed storage in development; S3-compatible storage for hosted use | Large proof, experiment, and log artifacts stay outside graph rows |
| Queue | Durable PostgreSQL jobs with leases and retries | One dependable state store initially |
| Event delivery | Server-sent events with cursor-based catch-up | Incremental graph updates and replay |
| Workers | Separate Python processes/containers plus Devin API sessions | Isolate computation and proof checking; dispatch AI work to Devin |
| Deployment | Docker Compose for the pilot | Small operational footprint; evolve after measuring load |

Consider Temporal for more complex durable orchestration later. Avoid adding a graph database or Kubernetes merely because the product displays a graph.

### 7.2 System diagram

```text
Researcher <----> Web UI / 3D graph
                       |
                 Application API
                       |
        Atlas / portfolio controller + event log
                       |
         Source intake + campaign scheduling
            /          |             \
     PostgreSQL     Job leases     Artifact store
                       |
       +---------------+-------------------+
       |               |                   |
  Devin sessions  Evolution control   Math workers
  propose,        selection and       experiments,
  investigate,    bounded search      counterexamples,
  formalize                           proof checking
       \               |                   /
        +---------- Candidate artifacts --+
                       |
            Independent verification
                       |
              Evidence + graph events
```

### 7.3 Two complementary Devin integrations

**Devin uses the lab as a tool.** Expose a small custom MCP server backed by the same application API. Devin's [MCP documentation](https://docs.devin.ai/work-with-devin/mcp) documents custom STDIO, SSE, and HTTP servers.

Proposed application-defined tools:

```text
browse_atlas(area_id, filters, cursor)
get_area_coverage(area_id)
submit_problem_candidate(source_ids, statement, area_ids)
propose_problem_status(problem_id, source_id, status)
get_problem(problem_id)
get_research_context(idea_id, token_budget)
search_results(query, filters)
propose_idea(problem_id, parent_ids, structured_idea)
request_experiment(idea_id, experiment_spec)
request_proof_check(claim_version_id, artifact_id)
record_observation(attempt_id, observation, artifact_ids)
get_frontier(campaign_id)
```

These names are proposed product interfaces, not claims about existing Devin built-ins. In particular, workers can submit evidence candidates but cannot set their own `verified` status.

Use separate review permissions for admitting problem records, confirming resolution status, and certifying mathematical evidence. The atlas API returns canonical problem IDs so a problem classified in several fields still has one history.

**The lab assigns work to Devin.** Use the documented [session-creation API](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions) behind a provider adapter. The documented surface includes repositories, session tags, `devin_mode`, `max_acu_limit`, and a `structured_output_schema`. Verify the current API contract and account permissions when implementing.

**Use Sharon's account.** Authenticate as Sharon using a supported personal access token, or use a service user with `create_as_user_id` set to Sharon's user ID and the required impersonation permission. The [API attribution documentation](https://docs.devin.ai/api-reference/overview#session-attribution) says these sessions count toward the named user's usage as if that user created them. Keep credentials in backend secret storage. Do not leave sessions attributed to a separate service identity by accident; confirm attribution and usage reporting with the first integration assignment. This plan selects the account but does not provision credentials or change billing settings.

The controller should:

- Create bounded tasks with explicit deliverables and stopping conditions.
- Send the assignment's selected `devin_mode` explicitly and record the requested mode separately from provider-reported metadata.
- Tag sessions with campaign and attempt identifiers.
- Include the portfolio and area identifiers, or a discovery-job identifier when no problem campaign exists yet.
- Require structured output plus retrievable artifact references.
- Monitor both session status and completion/output state; a transport-level “running” state need not mean useful work is ongoing.
- Handle waiting-for-user, approval, suspension, quota, and error states explicitly.
- Track session IDs so retries and restarts do not create duplicate work.
- Reconcile uncertain creation outcomes before retrying an API call.

Do not assume a session's local filesystem is available to another session. Exchange artifacts through the lab's store or a versioned repository.

### 7.4 Worker granularity

Roles are bounded task templates assigned as work becomes eligible.

| Task role | Example assignment |
|---|---|
| Area explorer | Find sourced problems in an under-covered subfield and identify missing or stale records |
| Status researcher | Check a problem's reported open status against later literature and propose a sourced update |
| Researcher | Check whether a proposed lemma is already known and locate exact assumptions |
| Hypothesis generator | Produce distinct approaches with falsifiable next steps |
| Experimenter | Implement and run a bounded construction/counterexample search |
| Prover/formalizer | Formalize a frozen claim or discharge a specified proof obligation |
| Critic | Identify gaps, hidden assumptions, and invalid composition steps |
| Verifier | Rebuild and check supplied artifacts under controlled rules |

Use Devin for all AI task roles, including proposal batches and critiques, and ordinary workers for deterministic checks. One Devin session can produce several hypotheses or advance a branch through multiple steps; a graph node does not imply a new session. Route any adopted evolution engine's proposal requests through the Devin adapter, or retain the application-owned controller if the engine assumes incompatible synchronous model calls.

Start with two concurrent Devin jobs across the entire portfolio and a small CPU worker pool, then adjust to measured latency, limits, and budget. Broad coverage comes from rotating bounded work, not from launching a permanent worker for every subfield.

Formalization assignments include the claim version, approved Lean target when available, informal argument, lemma obligations, allowed dependencies, and known gaps. Return a checked artifact or precise remaining obligations; a prose claim of success cannot substitute for checker evidence.

**Selectable Fusion and Ultra assignments.** Let authorized collaborators choose either mode for a new assignment, with a versioned campaign policy supplying the default. Freeze that choice when dispatching; later policy changes apply to future assignments. Start the pilot with matched assignments in both modes rather than a permanent global winner. All sessions remain attributed to Sharon under the existing Max account.

Fusion's [documented architecture](https://cognition.com/blog/local-fusion) pairs a lead responsible for planning and review with a sidekick for delegated execution. It is a candidate for construction experiments, counterexample searches, and iterative Lean development. Its internal delegation does not replace the application's campaign scheduler, evidence graph, or independent proof checker.

The [CLI/Desktop Fusion documentation](https://docs.devin.ai/cli/fusion) recommends Fable 5.1 + SWE-2 and exposes pairing controls. The cloud API documents `devin_mode: "fusion"` but no per-request lead/sidekick selector; do not infer that it uses the CLI's recommended pair. Record underlying models only when the provider exposes them, and otherwise mark them unknown. Confirm cloud access to both modes during integration. If a requested mode is unavailable, record that condition; do not silently substitute another mode or count a substitute as a comparison result.

### 7.5 Reliable long-running operation

- Leases and heartbeats recover abandoned jobs.
- Unique attempt IDs make result ingestion idempotent.
- A transactional outbox prevents committed graph changes from losing their UI events.
- Checkpoints capture discovery and research frontiers, area rotation, archive, policy, dependency versions, and spend.
- A pause stops dispatch immediately and applies a documented policy to in-flight work.
- Failed providers trigger bounded retries and circuit breakers.
- A central budget ledger includes reserved cost for in-flight jobs.
- A replay rebuilds decisions and the UI from recorded events.

Recorded runs should be replayable. Re-running a Devin assignment is not guaranteed to reproduce the same outputs; retain original outputs and environment manifests.

### 7.6 Public browsing and private research controls

Provide two views of the same system:

- **Public explorer:** anonymous browsing, search, filtering, timeline replay, and automatically published research and evidence with explicit labels and downloadable result packages.
- **Research workspace:** authenticated editing, source review, hypothesis branching, campaign controls, publication-policy management, and budget management for the owner and invited collaborators.

The owner manages invitations, spending caps, and collaborator permissions. Collaborators can operate assigned campaigns within their granted limits; raising a cap requires the owner's permission. Research workers use scoped credentials for their assignments and cannot grant access, bypass publication rules, or certify their own evidence. A dedicated publisher automatically releases eligible updates from the application's event log.

Enforce permissions on the API, job-dispatch endpoints, MCP tools, and artifact access. Hiding buttons is only a UI convenience. Anonymous browsing and search must query stored published data without initiating model calls or paid research jobs.

Use versioned publication records to expose public fields, artifacts, and relationships. Map records, research branches, informal candidates, and status changes publish automatically as they are recorded; none waits for manual publication approval. The public view includes exact statements, citations, review dates, and evidence labels. Keep credentials, internal prompts/logs, explicitly private material, and detailed spending records private. Only publish source material whose redistribution is permitted.

Preserve informal candidates' unverified label, review status, and outstanding Lean obligations in the graph, detail view, and exports. Unreviewed work remains visibly unreviewed; human review is not a release gate. A Lean-verified label requires an independent successful check of the exact claim version. Publishing a proposal never marks its root problem solved or its novelty established.

Public users watch an automatically updated, publication-filtered event feed. New descendants and revisions enter that feed under the same rules, including failed attempts, archived branches, corrections, and retractions. Keep the record version and its evidence labels together so a changed statement cannot inherit an old verified badge. Show the last public event time and any processing delay.

Publish from a durable outbox with idempotent event handling and replay after interruption. Automated field filtering, schema validation, and source-reuse checks protect the private/public boundary without requiring editorial approval. Withhold only affected content when these checks fail, record the reason privately, and continue publishing other eligible updates. Collaborators can correct or withdraw content without becoming a required step in routine publication.

Filter search, graph edges, aggregate counts, timeline replay, exports, and events consistently. A public relation must not reveal a private endpoint. Published proof packages must disclose the assumptions and dependencies needed to assess the result; an unpublished required dependency blocks publication of the complete proof claim or is clearly marked as unavailable.

Withdrawal removes a record from public APIs and invalidates cached views and application-hosted artifact access. It does not promise to erase copies already downloaded. Community submissions and public editing are outside the selected initial scope.

---

## 8. The 3D research interface

The graph should answer: **What is being tried, what has been learned, why was this branch promoted, and what should receive attention next?**

At the atlas level, it must also answer: **Which regions have been mapped, what problems are reported open, how current are the sources, and where are there connections between fields?**

### 8.1 Layout and visual language

- Open on a broad atlas overview with stable area clusters. Expand an area into subfields and problem nodes, then enter a problem's research branches.
- Use breadcrumbs and an explicit atlas/research-view switch. Geographic placement in the atlas and generation depth inside a campaign encode different things.
- Give shared problems one canonical identity; secondary memberships appear as links or labelled references, without duplicated research or counts.
- Put generation/depth on the vertical axis in lineage mode.
- Use the horizontal plane for stable method-family clusters and local relationships.
- Offer a separate semantic view, clearly labelled approximate.
- Anchor old nodes and animate only local additions to preserve orientation.
- Draw refinement, logical dependency, contradiction, and citation edges differently.
- Show node type by shape/icon and evidence by colour and text badges.
- Represent node size as useful downstream contribution or a selected metric, never an unexplained “truth” score.
- Dim archived branches without deleting them.
- Show source freshness and reported problem status separately from research evidence. A problem with no active campaign still belongs on the map.
- Expand cross-area edges on demand, with their relation type and supporting source or proof. Default to a readable neighbourhood rather than all edges at once.

For multiple parents, lineage depth is one plus the maximum parent depth. Selection epoch and creation time remain separate fields. A node's geometry is a navigation aid, not a mathematical measure of closeness to proof.

### 8.2 Core interactions

1. Expand mathematics into areas, subfields, and problems; return to the overview without losing orientation.
2. Inspect a problem's exact statement, attribution, sources, status history, research campaigns, and cost.
3. Compare research siblings and see what changed from the parent.
4. Follow a proof's dependency graph to unresolved obligations.
5. Replay atlas expansion or a campaign through time, including selection snapshots.
6. Pin an area, problem, or idea; request exploration or critique; choose Fusion or Ultra for an assignment and inspect its recorded mode; allocate a bounded extra budget.
7. Filter by area, problem, method, evidence, status, source freshness, age, and cost.
8. Search statements and jump to related nodes, including cross-area connections.
9. Export a sourced portion of the atlas, a research subtree, or a reproducible result package.

Public visitors have browsing, comparison, search, replay, and export interactions for automatically published material. Pinning research priorities, branching, editing, campaign controls, spending, and publication-policy changes require collaborator access. Show publication timestamps and evidence labels in both views.

For a proof candidate, expose its informal argument alongside the corresponding Lean target, verified lemmas, remaining obligations, and formalization blockers. Link informal and formal versions so visitors can follow the progression without treating partial formalization as a completed proof.

### 8.3 Suggested screen

```text
┌ Atlas > area > problem ─ budget ─ jobs ─ pause/resume ────┐
│ Areas / filters   │                                      │
│                   │       3D atlas / research graph      │
│                   │                                      │
│                   ├──────────────────────────────────────│
│                   │ Selected node: sources / status      │
│                   │ obligations / sources / cost / tools │
├───────────────────┴──────────────────────────────────────┤
│ Timeline, generation snapshots, noteworthy events        │
└─────────────────────────────────────────────────────────┘
```

This sketch is the private research workspace. The public view replaces budget, job controls, and pause/resume with publication status and navigation; it uses the same graph renderer with published records only.

### 8.4 Scale and accessibility

Do not render the entire atlas or a long-running campaign at once. Serve bounded neighbourhoods, cluster summaries, and level-of-detail expansions. Count unique problems separately from area memberships and speculative ideas. Compute costly layouts away from the browser's main thread; persist positions where useful.

Use the 3D renderer's capabilities first, then optimize based on measurements. Add a 2D/list view, keyboard navigation, reduced motion, and text status labels so research does not depend on spatial navigation or colour vision.

Provisional performance targets: fluid interaction for roughly 1,000 visible nodes on a declared reference laptop; a larger total graph browsed through clustered subsets; recent results displayed within two seconds under pilot load. These are acceptance targets to measure, not guarantees from a library.

---

## 9. Evaluation: prove the system helps

### 9.1 Benchmark ladder

**Level 1 — correctness fixtures.** Known true and false statements, deceptive changes in assumptions, duplicate statements, incomplete proofs, dependency failures, and exact finite witnesses. Include stale open-problem listings, conflicting sources, unsupported generated conjectures, and the same problem classified in multiple fields.

**Level 2 — known mathematics.** A reviewed sample across the nine initial navigation groups, with at least one appropriate task per group. Include problems the base model sometimes fails, so search has room to help. Track theorem proving, reductions, constructions, and source/status review separately; a literature result is not a proof completion.

**Level 3 — formal benchmarks.** Selected compatible tasks from [PutnamBench](https://github.com/trishullab/PutnamBench) and/or miniF2F. Pin dataset revisions and inspect all auxiliary definitions and solution placeholders. A target theorem must not pass because its answer definition or dependency contains a placeholder.

**Level 4 — construction benchmarks.** Reproduce selected FunSearch/AlphaEvolve problem evaluators and known constructions. Include direct Devin attempts and classical-search baselines.

**Level 5 — open problems.** Bounded campaigns selected from the broad atlas, initially covering at least three different areas and rotating further as budget permits. Use expert-reviewed statements and current literature checks. New useful lemmas, counterexamples, and improved bounds are meaningful outcomes even before a complete solution.

The atlas can cover many more problems than are actively investigated. Evaluate breadth and record quality separately from success at solving selected targets.

### 9.2 Compare at equal budgets

Run at least:

- Direct Devin attempts without evolutionary selection.
- Independent repeated attempts without inter-generation memory.
- Simple best-first/beam search.
- Diversity-preserving evolutionary search.
- The full system with retrieval and reusable verified lemmas.

For search-policy comparisons, hold Devin mode fixed and keep root statements, tool access, and effort limits comparable. Measure multiple independent runs; initially five repeats on a small representative subset, then increase only if results justify it. Ablate critique, diversity, and retrieval to see which components earn their cost. These comparisons do not require separate model-provider APIs.

Report results by field and evidence tier, with equal-weight field summaries alongside cost-weighted totals. Do not let a large easy benchmark from one area hide poor coverage elsewhere. Compare portfolio policies too: uniform rotation, concentration on observed progress, and protected area exploration at the same total budget.

**Initial Fusion-versus-Ultra comparison.** Separately hold the search policy fixed and vary only the requested mode. Use a small task set spanning at least three mathematical areas and covering construction/counterexample work, informal reasoning and critique, and Lean formalization. Include known answers and deliberately flawed arguments so missed assumptions can be measured.

Give both modes the same frozen statements, source context, starting lemmas, tools, environment versions, deliverables, and supported effort/time limits. Use fresh sessions, initially five independent attempts per mode on each selected task, and interleave dispatch order. Keep comparison outputs out of the other runs' input memory until evaluation ends. Record actual consumption because equal session counts do not imply equal usage.

Score exact-target Lean completions, checked counterexamples, useful verified lemmas, progress on fixed proof obligations, missed assumptions, formalization mismatches, and reproducibility. Use independent checkers and record reviewer uncertainty for informal reasoning; a model's self-assessment or its own sidekick's approval is not ground truth. Report completion rates and variability by task type, alongside time and usage per useful checked result. Also show what each mode achieves within a common total effort allowance where supported.

Choose task-specific defaults only when the pilot provides a consistent quality advantage or comparable quality with better throughput. If results are mixed or inconclusive, retain both modes and report that outcome. Published Fusion coding benchmarks are background evidence; they do not establish superiority over Ultra for mathematical research.

### 9.3 Metrics

Primary:

- Independently checked Lean target completions per fixed budget; report other checked artifacts separately.
- Cost and time to the first useful checked artifact.
- Verified intermediate results that materially help a target.
- False acceptance rate and formalization mismatch rate.
- Domain-expert usefulness assessments.

Secondary:

- Distinct methods explored, duplicate rate, branch revival usefulness.
- Reused lemmas, cache hit rate, retrieval quality.
- Worker failure rate, recovery time, budget overshoot, and UI latency.
- Cost and time from a promising informal candidate to a Lean proof, outstanding formalization work, and gaps uncovered during translation.
- Fusion/Ultra results by requested mode and task type, including assumption errors, unavailable-mode attempts, reported model metadata, and variability across repeats.

Atlas quality:

- Independently sampled accuracy of problem statements, attribution, and reported status.
- Coverage by area and source, including unknown and unmapped regions.
- Duplicate and false-merge rates; fraction of records with precise source locations.
- Source freshness, delay in detecting a reported resolution, and unresolved status conflicts.
- Opportunity and spend by area, plus explicitly recorded tool-coverage gaps.
- Useful, reviewed cross-area transfers rather than the raw number of connecting edges.

Do not use total nodes, generated tokens, self-rated confidence, or paper length as research success measures.

### 9.4 Leakage and novelty controls

Public benchmark proofs may occur in model training data. Report that limitation and do not call benchmark success new mathematics. Hold out problems, problem families, and evaluation examples where practical. Keep final construction checks separate from feedback used during search.

Before expanding compute, require evidence that the search policy offers a useful quality/cost tradeoff against the strongest simple baseline. If it does not, improve the evaluator or task selection first.

---

## 10. Budgeting and compute

**Selected account: Sharon's existing Devin Max plan.** Attribute the project's Devin sessions to Sharon and use that account's current usage policy. A separate dollar budget is not required to finalize this plan. The [self-serve billing documentation](https://docs.devin.ai/admin/billing/self-serve) describes Max's weekly allowance and on-demand credits; account limits remain operational inputs to scheduling.

Track consumption for research comparisons and reliable operation:

```text
initial portfolio usage =
    Devin sessions attributed to Sharon
  + mathematical computation and independent Lean checking
  + application hosting, storage, and networking
```

Record usage in the units Devin exposes; do not convert Max usage using an assumed Enterprise ACU price or double-count Devin's internal model work as separate API charges. Track hosting and CPU usage independently. Keep actual reported usage distinct from estimates and in-flight reservations. Separate model APIs, specialist prover subscriptions, and GPU services are outside the initial dependency set.

### Initial operational defaults

- Explicit launch of a continuing portfolio using the existing account settings.
- A shared capacity ledger across discovery and campaigns; an additional monetary cap is optional.
- Two concurrent Devin sessions globally, with fair scheduling between mapping and research.
- At most 32 new hypotheses in a dispatch batch across active campaigns.
- An active frontier around 24 ideas across initially 3–6 problem campaigns; the atlas inventory is separate and may be much larger.
- Bounded source-intake batches, per-source request limits, and resumable literature review.
- A selection snapshot after about 20 completed attempts or ten minutes.
- Bounded repair attempts per artifact; stop repeated identical failures.
- A configurable reserve for verifying promising final results.

These are starting configuration values, not universal settings. A campaign may produce many cheap ideas but only a few expensive investigations. If available capacity cannot sustain the chosen number of campaigns, reduce concurrent investigations and rotate areas without deleting their mapped problems. Checkpoint work when an account limit prevents dispatch and resume when capacity becomes available.

### Example effort allocation

For each 100 units of scheduled research effort, start with these relative shares. They are scheduling weights, not a new purchase or a requested spending cap:

| Purpose | Initial share |
|---|---|
| Atlas expansion, source review, and status refresh | 20 |
| Research campaigns: proposals, checks, investigation, and relevant retrieval | 60 |
| Independent verification and formalization | 15 |
| Retries and contingency | 5 |

Apply Section 5's 50/25/15/10 search shares inside the research allocation, not as additional spend. Distribute that allocation across areas using rotating opportunities and explicit coverage/progress decisions. Unused verification reserves are not automatically released into speculation.

Treat the 15-unit formalization/verification share as a starting allocation. When promising candidates accumulate, rebalance available capacity toward closing their Lean obligations; preserve unfinished work for the next scheduling window.

Quote expected campaign throughput only after observing actual Devin usage, task completion rates, and proof-checking latency. The scheduler should use usage information where available and handle account-limit responses explicitly rather than assume every quota value has an API endpoint.

Reserve capacity before dispatching jobs and reconcile usage on completion. If an owner later configures a monetary cap, enforce it across the whole portfolio with headroom for reporting delays and supported provider/session limits.

---

## 11. Implementation roadmap

Effort estimates below describe work Devin could perform, assuming repository and API access are ready. External access approvals, specialist review, and research outcomes are separate uncertainties.

### Phase 0 — Seed the broad atlas and test the foundations

**Approximate effort: one session, with specialist statement review as needed.**

- Agree the initial navigation groups and prepare 3–5 source-backed candidate problems per group, explicitly flagging incomplete reviews.
- Test source intake on curated lists from multiple areas; validate statement, status, provenance, and duplicate handling on a small reviewed sample.
- Choose demonstration tasks from at least three areas, including a construction, a proof, and a task without a cheap executable evaluator.
- Compare the setup and adapter surfaces of OpenEvolve/ShinkaEvolve and TreeThink/lean_evolve, including whether AI work can use Devin sessions.
- Check a complete Lean artifact through the chosen pinned environment.
- Confirm Sharon's API-session attribution, structured results, usage reporting, and artifact retrieval for one bounded assignment.
- Confirm that both Fusion and Ultra can be requested through the cloud API and record which mode/model details the API actually returns.
- Record the dependency/hosting/license decisions.

**Exit:** A sourced atlas seed and concrete stack decisions backed by running compatibility checks, with coverage gaps visible. If a candidate project is too coupled or incomplete, use its method as a reference and retain a thin application-owned scheduler.

### Phase 1 — Atlas and research prototype

**Approximate effort: two to three engineering sessions, plus configured pilot experiment runtime.**

- Implement area, source, source-assertion, problem, portfolio, claim, idea, relation, attempt, artifact, and event records.
- Add reviewed source intake, multi-area classification, dated status records, and atlas expansion jobs.
- Add the worker contract and the Devin session adapter under Sharon's account.
- Add per-assignment Fusion/Ultra selection, campaign defaults, and persisted mode provenance.
- Build a bounded portfolio/campaign scheduler with area rotation, archival selection, and global/local pause/resume.
- Add one mathematical experiment adapter and a whole-file Lean checker.
- Link informal candidates to Lean targets and obligation lists; display proposal, review, and formalization status separately.
- Integrate proposal batches and investigation tasks through the Devin API, with deterministic checking in ordinary workers.
- Show area/subfield/problem navigation and research branches, with sources, evidence, and selection snapshots in 3D.
- Add owner/collaborator authentication, private research endpoints, and an anonymous explorer fed by automatically published versions with evidence labels.
- Run the initial matched Fusion/Ultra task set once experiment and Lean checkers are ready; retain artifacts and evaluation results.

**Exit:** A researcher can navigate the broad map, expand a region, launch bounded investigations across areas, inspect why branches survive, and recover both mapping and research after restart. The first Fusion/Ultra comparison is recorded, with any access gaps or inconclusive results explicit. An anonymous visitor sees public updates without a manual release step and has no access to edits, spending, or private records.

### Phase 2 — Dependable pilot

**Approximate effort: another one to two sessions.**

- Add leases, budget reservations, idempotent ingestion, retries, and event replay.
- Complete axiom checks, independent rebuilds, and immutable formal targets.
- Add resumable formalization attempts and feed discovered proof gaps back into the hypothesis graph.
- Add typed dependency composition, counterexample propagation, and result export.
- Add compatible evolution and proof-search adapters where the spike supports Devin-driven work; otherwise keep the application-owned search loop.
- Expose the MCP tools for interactive Devin use.
- Add audit and regression fixtures for false acceptance and malformed results.
- Add periodic source refresh, disputed/resolved-status review, cross-area links, and starvation checks for portfolio scheduling.
- Complete automatic publication, filtered events, search, exports, and artifact delivery; test replay, evidence-label consistency, collaborator revocation, and withdrawal.

**Exit:** Crash recovery, budget handling, and rejection of invalid proof artifacts pass explicit tests. A failed worker cannot promote its own result.

### Phase 3 — Measure and improve research quality

**Approximate effort: one session for the harness and analysis, plus configured experiment runtime.**

- Run the benchmark ladder and equal-budget comparisons.
- Use the pilot's Fusion/Ultra evidence to select task-specific defaults; broaden the comparison only where uncertainty or new task types justify it.
- Audit atlas coverage and source/status accuracy independently of research success.
- Add literature retrieval and deterministic deduplication; use semantic matching as a review aid.
- Calibrate diversity and selection with observed outcomes.
- Add a result-review workflow for a mathematician.

**Exit:** A report explains whether the additional search machinery beats the simple baseline and which failure modes remain.

### Phase 4 — Open-problem campaigns and scale

**Approximate effort: one to three sessions for additional engineering, depending on requirements.**

- Investigate current open problems across several areas, rotate into underexplored regions, and expand the sourced inventory.
- Add domain-specific evaluators, new prover backends, and useful classical generators.
- Support portfolio/campaign comparison, validated cross-area transfers, large-atlas aggregation, and more granular collaborator roles if needed.
- Consider trained proposal models only after accumulating usable trajectories.

**Exit:** A repeatable process produces reviewed mathematical artifacts and clear records of unsuccessful exploration. Novel results remain a research outcome, not an engineering deadline.

### Suggested first deliverable

An atlas with all nine initial area groups and the reviewed portion of the 27–45-problem seed, with unfinished records clearly marked. From that map, launch demonstration campaigns in at least three areas:

- A finite-construction or graph task where a plausible false conjecture is disproved and revised.
- A known theorem from another area, developed as a labelled informal candidate and then formalized and independently checked in Lean.
- An analysis, geometry, or foundations task that yields a precise reformulation, sourced dependency map, or reviewed special case without relying on a numeric fitness score.

Use known or deliberately constructed tasks for the demonstrations and label them separately from open-problem records. Display the complete history in 3D, including movement from the atlas into each campaign.

This demonstrates broad mapping and the essential research loop without confusing a demonstration with a new discovery.

---

## 12. Acceptance criteria and test plan

### Atlas integrity

- Navigate from the broad overview through areas and subfields into sourced problems and research branches.
- Preserve one canonical problem across multiple area memberships and count it once in portfolio totals.
- Attach attribution, source location, status basis, and review date to every admitted problem.
- Distinguish literature problems from generated conjectures and unreviewed candidates.
- Preserve status history when a source reports a resolution; retain past research and flag conflicting reports.
- Reject irrelevant intake entries and route uncertain duplicate/equivalence matches for review.
- Display unmapped or stale regions without implying a complete census of mathematics.

### Mathematical integrity

- Reject proofs with transitive `sorryAx` or unapproved axioms.
- Reject an artifact proving a weakened or differently scoped target.
- Do not convert passing finite tests into an unbounded theorem.
- Recheck exact witnesses independently of their generators.
- Mark dependent results for review after a premise changes or fails.
- Keep “potentially novel” separate from “formally verified.”
- Allow informal and direct Lean exploration of the same problem; do not require formal-library coverage at intake.
- Publish an informal candidate only with its unverified and review labels intact.
- Keep expert-reviewed candidates distinct from Lean-verified results.
- Reject promotion to Lean verified when only sublemmas pass or the root statement has changed without approval.
- Preserve formalization blockers and resume pending work without discarding its informal source.

### Search behaviour

- Preserve at least the configured method diversity where eligible candidates exist.
- Archive and revive branches without erasing provenance.
- Deduplicate exact repeated artifacts.
- Record selection rationale and policy versions.
- Distinguish failures, timeouts, and mathematical counterexamples.
- Exercise area rotation and protected exploration under a fixture where one field produces much cheaper feedback than others.
- Keep culling local to research scheduling; preserve unsolved-problem records and provenance.
- Require explicit assumptions and verification for cross-area theorem transfers.

### Operations

- Kill a worker and recover its lease without accepting duplicate results.
- Restart the controller and continue from a persisted checkpoint.
- Simulate a lost API response and avoid blindly creating another Devin session.
- Simulate account-limit responses and verify checkpointing, stopped dispatch, and later resumption without duplicate work.
- Verify capacity reservations and any configured optional cap across discovery jobs and all campaigns, including global pause and independent campaign completion.
- Verify API-created sessions are attributed to Sharon and the initial research loop works without a separate model-provider credential.
- Verify explicit Fusion/Ultra dispatch, retained requested/reported mode data, and visible handling of unavailable modes without silent substitution.
- Verify comparison runs use frozen inputs and do not retrieve findings from sibling benchmark attempts.
- Restore a database/artifact backup and replay the graph.

### Interface

- Inspect lineage, dependencies, evidence, and cost for the same node.
- Pause/resume, pin, branch, and review a selection snapshot.
- Navigate with keyboard and in the 2D/list alternative.
- Meet measured graph-interaction and update-latency targets on a declared test machine.

### Public access and permissions

- Browse the published atlas without signing in, including automatically updated research branches and evidence.
- Reject anonymous write, campaign-control, publication, and spending requests on every API and MCP surface.
- Enforce invited collaborators' assigned permissions and budget limits on the server.
- Keep private records out of public search, graph edges, counts, events, replay, exports, and artifact URLs.
- Automatically publish eligible descendants, revisions, and proof proposals without requiring a collaborator to release them.
- Keep explicitly private descendants and fields excluded even when their parent is public.
- Publish corrections and failed checks promptly; never copy a verified badge onto a changed claim version.
- Recover interrupted publication without duplicating events or losing their associated evidence labels.
- Verify that browsing never launches paid model or Devin work.
- Revoke collaborator access and withdraw a publication without leaving application-controlled public access active.
- Publish research evidence with its actual proof/status labels; publication alone cannot promote a claim to verified.

---

## 13. Main failure modes and design responses

| Failure mode | Response |
|---|---|
| Fluent but invalid proofs | Evidence levels, adversarial examples, independent checks |
| Formalizing the wrong theorem | Frozen approved target; review definitions, quantifiers, and assumptions |
| Rewarding easy but irrelevant lemmas | Root relevance and dependency progress; calibrated human review |
| Evolution underperforming direct attempts | Equal-budget baselines and component ablations |
| Population collapses to one idea | Method quotas, novelty archives, fresh starts, branch revival |
| Broad exploration collapses to easy-to-score fields | Protected area opportunities, rotating campaigns, field-specific progress measures |
| Map accumulates stale, invented, or irrelevant problems | Source review, separate generated conjectures, dated status assertions, refresh and quarantine |
| The same problem fragments across fields | Canonical IDs, multi-area membership, reviewed equivalence and merge decisions |
| Cross-area similarity is mistaken for a proof connection | Typed relations and explicit verified transfer obligations |
| Expensive redundant exploration | Exact hashing, scoped caches, retrieval, shared verified lemmas |
| Evaluator overfitting | Frozen final checks, separate test distributions, independent witness checking |
| False novelty claims | Recorded literature searches and domain-expert assessment |
| Incorrect imported knowledge | Source provenance; unverified imports cannot serve as certified premises |
| Version drift | Pin tools, libraries, models where possible, and artifact manifests |
| Unbounded spend | Reservations, concurrency limits, session caps, pause and stop policies |
| Unreadable 3D graph | Local views, clustering, stable layout, filtering, 2D/list alternative |
| Public viewing exposes drafts or enables spending | Explicit publication versions, consistent read filtering, server-side permissions |
| Research stops with a session | Durable controller and external artifact store |

---

## 14. Practical first build decision

If starting now, I would use:

**React/TypeScript + react-force-graph-3d; FastAPI + PostgreSQL; durable jobs; content-addressed artifacts; a Devin API/MCP adapter using Sharon's Max account; Lean 4 + mathlib + LeanInteract; and an application-owned evolution controller.**

I would first inspect Mathematical Discovery Engine for reusable UI/schema ideas and compare TreeThink with lean_evolve for the proof-search lane. OpenEvolve and ShinkaEvolve remain adapter candidates if they can use Devin for AI work. I would keep the scientific record and verification pipeline application-owned, even if a search engine is replaced.

The first product milestone should be **a broad, sourced atlas connected to trustworthy, observable research loops**. Build breadth into classification, intake, navigation, and scheduling from the start. Add deeper mathematical tooling per area as measured needs emerge.

---

## 15. Decisions for Sharon

**Confirmed scope:** Explore broadly, branch into areas and subfields, and create a map of unsolved problems. This replaces the earlier single-domain pilot recommendation.

**Confirmed sharing:** Public viewing with private research controls. Visitors explore published material; Sharon and invited collaborators control editing, Devin investigations, publication, and spending within their permissions. Public contribution workflows are not part of the initial scope.

**Confirmed proof goal:** Explore both informal and formal approaches, propose clearly labelled informal proofs, and work toward independently verified Lean proofs. Informal candidates and expert review are valuable intermediate results; they do not replace the final Lean milestone.

**Confirmed publication:** Automatically update the public map with clear evidence and verification labels, including informal proof proposals and verified results. No manual release gate applies; research controls and private operational data remain restricted.

**Confirmed Devin access and budget:** Use Sharon's existing Max plan and attribute automated research sessions to Sharon. Devin performs the initial AI work; no separate model-provider API or new dollar-budget decision is required.

**Confirmed mode strategy:** Include a matched Fusion-versus-Ultra comparison in the initial pilot and make both modes selectable per research assignment. Keep the default policy configurable, use checked mathematical outcomes to guide it, and avoid promising a specific underlying cloud model pairing.

**Mathematical review default:** Surface review gaps and retain provisional labels until a suitable reviewer is available. Review assignments can be chosen later; publication and exploratory work do not wait for a reviewer to be recruited.

The main product and access decisions are settled. The atlas remains broad at any worker concurrency, with automatic public updates and Lean proof production as its long-term research goal.

---

## Source guide

Links in the project tables point to primary repositories or official documentation. The following sources underpin the central design decisions:

- [FunSearch implementation and release boundaries](https://github.com/google-deepmind/funsearch)
- [OpenEvolve architecture and examples](https://github.com/algorithmicsuperintelligence/openevolve)
- [ShinkaEvolve architecture and execution options](https://github.com/SakanaAI/ShinkaEvolve)
- [AlphaEvolve mathematical problem materials](https://github.com/google-deepmind/alphaevolve_repository_of_problems)
- [Aletheia: Towards Autonomous Mathematics Research](https://arxiv.org/html/2602.10177v1)
- [Even with AI, Bijection Discovery is Still Hard](https://arxiv.org/html/2511.20987v1)
- [Lean: Validating a Lean Proof](https://lean-lang.org/doc/reference/latest/ValidatingProofs/)
- [Lean: Axioms](https://lean-lang.org/doc/reference/latest/Axioms/)
- [LeanInteract capabilities and experimental tactic-mode caveat](https://github.com/augustepoiroux/LeanInteract)
- [PutnamBench](https://github.com/trishullab/PutnamBench)
- [Erdős Problems FAQ and status caveats](https://www.erdosproblems.com/faq)
- [MSC2020 classification, formats, and licensing](https://msc2020.org/)
- [American Institute of Mathematics problem lists](https://aimath.org/problemlists/)
- [Open Problem Garden](https://www.openproblemgarden.org/) and [area index](https://www.openproblemgarden.org/container/area)
- [Devin session creation](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions)
- [Devin API overview](https://docs.devin.ai/api-reference/overview)
- [Devin API session attribution](https://docs.devin.ai/api-reference/overview#session-attribution)
- [Devin Max and other self-serve plans](https://docs.devin.ai/admin/billing/self-serve)
- [Devin custom MCP integration](https://docs.devin.ai/work-with-devin/mcp)
- [Fusion architecture and coding benchmark results](https://cognition.com/blog/local-fusion)
- [Fusion pairing controls and availability in CLI/Desktop](https://docs.devin.ai/cli/fusion)
- [React force-graph rendering](https://github.com/vasturiano/react-force-graph)

Research status: sources inspected September 19, 2026. Availability, licenses, API details, problem status, and compatibility should be rechecked when dependencies are pinned for implementation.
