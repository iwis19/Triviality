# Collaboration protocol

1. Coordinator assigns two different investigations and proposes a formal
   target only when the user has not supplied one.
2. Two researchers work concurrently: constructive reasoning and independent
   counterexample/assumption analysis. Reports include evidence, risks, and a
   proposed next step. A failed researcher is reassigned to the coordinator.
3. Critic sees BOTH reports and the fixed target. It selects an approach and
   chooses formalize, revise, or stop. Revision carries the critique and the
   colleague's report back to a researcher, then returns to the critic.
4. Proof writer receives the shared evidence and critique. Lean checks an
   application-owned theorem wrapper. Failure logs and the previous proof
   feed the next writer attempt; missing Lean stops repair immediately.
5. Delivery preserves findings, critique, target origin, proof, checker output,
   and the distinction between formal correctness and translation review.

The embedded runner checkpoints completed agent calls using the upstream
SwarmFlow journal/WAL. Restart the same episode with identical input to resume.
The native WorkSwarm host owns its own journal and lifecycle. Side effects of
the Lean check may repeat on resume; model calls with matching keys are cached.
