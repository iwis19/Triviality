# Pilot 1: Fusion vs Ultra on the lonely runner conjecture

Matched pair launched 2026-09-19 09:52 UTC through the lab's private API: same problem
(`lonely-runner-conjecture`), same role (`hypothesis_generation`), same prompt template, same
selection seed (42), `comparison_group=pilot-1`, 5-ACU cap per session, sessions attributed to the
owner's plan. One session per arm. Modes were requested explicitly and the provider reported the
same mode back (`reported_mode` == `requested_mode` for both).

| | Fusion | Ultra |
|---|---|---|
| Wall time | 3 min 39 s | 23 min 42 s |
| ACUs reported by API | 0.0 | 0.0 |
| Ideas / claims | 4 / 3 | 4 / 8 |
| Evidence items (attached after ingest fix) | 4 | 9 |
| of which numerical experiments | 2 | 4 |
| counterexample searches | 1 | 2 |
| informal proof sketches | 0 | 1 |
| critiques | 0 | 1 |
| literature checks | 1 (inconclusive: "from memory") | 2 (supports: sources found, full text unread) |
| Lean artifacts | 0 | 0 |
| Gaps self-reported | 6 | 9 |
| Largest exact enumeration | n=7, speeds <= 14 | n=7, speeds <= 20; n=5, speeds <= 34 |

The ACU figures are what the v3 API returned in `acus_consumed`; both were 0.0 at the time of
termination, so this pilot cannot compare cost. Wall time is the lab's own measurement.

## Mathematical content (all worker-reported, none independently certified)

Shared ground: both arms rediscovered the "gap jump" dichotomy already found by the earlier
normal-mode smoke session (the max lonely gap for n=7 is either exactly 1/8 or at least 2/15 on
the enumerated range) and both flagged that this may coincide with Kravitz's published
conjecture without verifying it.

Fusion-only: a negative result that Hunter's spanning-tree covering bound certifies none of the
3431 primitive n=7 sets with max speed 14, and a computation that the minimal certifying
denominator grows with the speeds (rules out bounded-modulus proofs). Idea 4 (Fourier majorant
for k=8) had no computation behind it.

Ultra-only: (I1) a "sum-denominator lemma" - the loneliness maximum is attained at t=1/2 or at a
crossing time a/(v_i+v_j) - with a three-step informal sketch and a check on 36,625 recorded
maximisers; (I2) SOS/Fourier interval-covering certificates in runner coordinates, with a
refutation of the naive "multiples basis" variant and an explicit critique that the approach
cannot handle tight tuples; (I3) explicit near-tight families with a literature link to the
Fan-Sun counterexample family (identified as the d=8 slice of the arm's own H-even formula); (I4)
a shared exact-breakpoint test-bed.

## Assessment

On checked mathematical progress neither arm moved the open problem; both said so explicitly.
Ultra produced strictly more structure per session: a candidate lemma with a proof sketch that
is a concrete Lean target (I1 is elementary and formalizable), a critique of its own strongest
idea, and a verified-looking literature connection. Fusion was ~6.5x faster and produced one
useful negative result but no proof sketch and no critique.

Decision for the lab's default role/mode table (plan section 5.3):

* `hypothesis_generation`, `critique`: **ultra** (depth per session matters more than speed).
* `experimentation`, `status_research`: **fusion** (tool-heavy, bounded, fast turnaround).
* `formalization`: **ultra** to start; revisit once Lean-verified artifacts exist for both.

This is one matched pair on one problem; the comparison group mechanism stays in place so later
pairs can update the table.

## Bug surfaced

Ultra used `I1`..`I4` as evidence targets while the ingestor only resolved exact titles or
database ids, so 8 of its 9 evidence items were dropped on first ingest. Fixed: ideas/claims
now carry a `local_id`, the ingestor indexes local ids, full titles, and leading labels
(`I1.`, `H2:`), keeps unresolvable evidence in `attempt.result.unattached_evidence`, and
`problem`-level evidence (status/literature checks) attaches to the problem itself.
`POST /private/attempts/{id}/reingest` replays stored output idempotently.
