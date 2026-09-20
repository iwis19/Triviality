# Planned improvements

## Host Lean checking and compilation on Vultr

Use a Vultr-provided VM to run Lean checking and compilation so users do not
need to install or configure Lean on their own machines.

- Provision the supported Lean toolchain and required dependencies centrally
  on the VM, with a reproducible setup.
- Have the research workflow submit formal statements and candidate proofs to
  the hosted checker and receive verification results and compiler diagnostics.
- Preserve the fixed-theorem checks and axiom audit when moving verification
  off the local machine. A failed check or unavailable service must remain
  unverified, never be treated as a successful proof.
- Bound execution resources and isolate verification jobs.

Status: agreed requirement, recorded for implementation. This note does not
provision a VM or change the runtime.

## Add a Vultr experiment worker for the Challenger

Run bounded mathematical experiments on a Vultr worker so the Challenger can
request computations and use returned evidence in the research workflow.
This is an execution service, not a smaller language model: the Challenger
retains responsibility for designing tests and interpreting results.

- Start with constrained experiment types such as bounded integer searches,
  finite case enumeration, and exact arithmetic. Validate structured requests;
  do not initially accept unrestricted model-generated programs.
- Return the tested claim, inputs, search bounds, outcome, concrete witnesses,
  execution diagnostics, and artifact/job identifiers for reproducibility.
- Distinguish counterexample found, no counterexample within the tested bounds,
  and execution failure. A negative bounded search is not a proof; a failed
  computation is not a refutation. Support passing suitable discovered witnesses
  to the hosted Lean checker for a formal disproof.
- Integrate through the existing WorkSwarm/JiuwenSwarm workflow: request an
  experiment, execute it, then return its evidence to the Challenger before
  finalizing feedback or a refutation decision. Persist results in the shared
  discovery bank and expose them in the research trace.
- Keep orchestration and model credentials outside isolated execution jobs.
  Enforce CPU, memory, runtime, output, and network limits, with durable job
  tracking and bounded retries.
- The experiment worker and Lean checker may share an initial Vultr VM while
  keeping individual jobs isolated. Separate or scale them only as workload
  measurements justify it.

Status: initial implementation added: authenticated bounded polynomial searches,
durable result caching, container configuration, and Challenger evidence handoff.
See [setup and limitations](experiment-worker.md). Vultr provisioning and the
remote deterministic demo have been completed; live provider validation remains
outstanding. Broader experiment types and automatic
Lean disproof generation remain future work; performance benefits are unmeasured.
