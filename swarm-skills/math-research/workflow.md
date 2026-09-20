# Exploration workflow

One coordinator creates three different approaches and a fixed formal target.
Three researcher branches run concurrently in each exploration round. Each has
its own report, feedback, generation and paper foundation. They retrieve from
the literature bank and live OpenAlex, then publish evidence to the discovery bank.
The branches are independent contexts within one SwarmFlow process, not three OS processes.

One challenger examines the deposited findings. Its structured feedback includes
an identified claim, mathematical evidence, a resolution test, unresolved gaps,
and a proposed alternative search. Assessment fields support scheduling; they
are not proof certificates. The researcher consumes the feedback in its next round.

A concrete refutation reported by the challenger triggers abandonment immediately.
Otherwise consecutive exchanges without progress trigger the user's stagnation
threshold. A failed Lean tactic is not a mathematical refutation. Abandoned
findings are marked and dependent findings challenged. The coordinator retrieves
related alternatives, adding random corpus samples after repeated failures;
a distant sample requires a plausible connection. The chosen source is handed
into a fresh branch context. Failure memory remains, but old private arguments do not.

Rounds synchronize at evidence-sharing boundaries. The challenger and writer
are serialized; this is bounded round-based exploration, not an asynchronous
background swarm. Researchers may request further retrieval via search_query.
A reviewed complete argument with no unresolved or abandoned dependencies goes
to the proof writer. Lean failures return to the evidence bank and researcher.
The first checked proof stops the run, with translation review still required
for a model-generated formal statement. Otherwise exploration uses the chosen
round limit and returns partial findings.

The host persists literature in MongoDB papers and extracted knowledge in
paper_nodes; discovery entries in research_discoveries retain branch, round,
generation, sources and evidence status. The portable workflow also returns
both banks in result.json. Retrieval snapshots and the upstream journal support
replay with unchanged input and workflow code. Queue crash recovery remains manual.
