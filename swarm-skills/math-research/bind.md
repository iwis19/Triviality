# Bounds and failure behavior

- Three concurrent researchers, one coordinator, one challenger and one writer.
- User controls exploration_rounds (1–20, default 4), stagnation_threshold
  (1–6, default 2), and total proof_attempts (1–6, default 2).
- Early completion requires Lean success. Model-generated targets still require
  human translation review. Challenger assessments are not formal verification.
- Embedded transport allows 200 model calls including retries, 120-second agent
  timeouts, a configurable token ceiling (default 60,000), and the Node host's
  total wall-clock timeout (default 15 minutes). These resource limits can stop
  work before all requested rounds. In-flight calls may overshoot token limits.
- Missing literature falls back to the stored bank or supplied sources. Abstracts
  and extracted knowledge are labeled; full paper downloads are not automatic.
- Missing challenger approval blocks proof writing. Failed researchers retry and
  may be reassigned at the stagnation threshold. Invalid replacement selections
  leave the branch abandoned until the coordinator supplies a valid replacement.
- Missing Lean leaves results unverified and disables further checker attempts.
- Native hosts own their budgets; without the embedded retrieval bridge the skill
  searches only supplied literature. The bridge exposes a fixed literature API,
  never arbitrary agent-generated URLs or shell commands.
- No credentials in journals or browser payloads. Lean syntax restrictions are
  not an OS sandbox; isolate the checker before public multi-tenant deployment.
