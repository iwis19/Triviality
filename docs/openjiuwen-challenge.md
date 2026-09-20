# Triviality: collaborative mathematical research

Triviality helps a researcher explore competing approaches, catch missing
assumptions, and produce auditable Lean artifacts. This branch implements the
challenge's **reusable Swarm Skill** path with a working executable workflow.

## What is actually integrated

`swarm-skills/math-research` is a WorkSwarm/JiuwenSwarm team skill, including
roles, coordination rules, dependency declarations and `scripts/workflow.py`.
The script calls the upstream `agent`, `parallel`, `phase` and `log` APIs.
The coordinator, researchers, critic and writer exchange structured results;
failed investigations are reassigned, critique can request revision or stop,
and Lean errors trigger bounded repair.

Two hosts can run the same script:

1. **Triviality's embedded host:** the unchanged SwarmFlow engine at the exact
   Core revision required by the pinned WorkSwarm source, with a small custom
   `AgentBackend` for OpenAI-compatible model endpoints. This avoids installing
   WorkSwarm's desktop, chat-channel and vector-store dependencies. Engine code
   is downloaded into ignored `.data/`, retains its upstream license, and is
   integrity-checked at startup. This is not the full WorkSwarm application or
   its native `TeamWorkerBackend`.
2. **Native WorkSwarm:** install the skill and invoke its script through the
   host's `swarmflow` tool. The host provides its own agent backend, models,
   journal and progress tree. This deployment requires a separate native-host
   smoke test before presenting it to judges.

The downloaded official repository currently uses the old `jiuwenswarm` URL
but declares package `workswarm` version `0.2.5.beta1`. Exact revisions are in
`apps/research-swarm/framework-lock.json`. Do not replace these with a moving
branch without rerunning the tests. The supplied challenge text is inconsistent
about whether other frameworks qualify; this implementation includes the
explicitly requested Swarm Skill format instead of relying on that exception.

## Local setup

Run everything from this repository root (the nested checkout containing
`apps/research-worker`). Python 3.11–3.13, Git and Node/pnpm are required.

```powershell
pnpm install --frozen-lockfile
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r apps/research-swarm/requirements.txt
.venv/Scripts/python.exe apps/research-swarm/setup_runtime.py
Copy-Item .env.example .env  # only when .env does not already exist
```

On macOS/Linux use `python3` and `.venv/bin/python`. The setup script fetches
the pinned framework revision from GitHub. For an existing clean checkout:
`python apps/research-swarm/setup_runtime.py --source /path/to/agent-core`.

WorkSwarm is the fixed orchestration layer for every new episode. The dashboard
assigns models independently to coordinator, researcher, counterexample researcher,
critic, and proof writer. Selections are validated against
`config/research-models.json`, persisted with the episode, and passed unchanged
to the workflow. Retries/revisions preserve the assigned model. Credentials stay
in the worker environment; no keys are included in jobs or frontend bundles.

Configure only the providers you select in `.env`:

| Dropdown provider | Worker settings |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Qwen (Alibaba Model Studio) | `QWEN_API_KEY`; optional `QWEN_BASE_URL` matching your region |
| Devin agent | `DEVIN_API_KEY`, `DEVIN_ORG_ID`, `DEVIN_MAX_ACU` (per session, default 2) |

Gemini uses Google's documented OpenAI-compatible endpoint. DeepSeek and Qwen
use their compatible endpoints too. Add or update model presets in the shared
catalog; there is no assumption that all API keys have access to every model.
WorkSwarm itself does not issue an API key. Configure credentials for the
named providers selected in each role dropdown.

Devin uses v3 create/get/terminate sessions with a required output schema.
Completed output is handed back to WorkSwarm, which retains coordination.
Session IDs are recorded per call for replay; active sessions are terminated
when a call finishes or fails. A process crash or uncertain create response can
still leave a remote session requiring manual cleanup. Devin reports ACUs
separately; `SWARM_TOKEN_BUDGET` cannot measure or cap Devin's token usage.
The per-session ACU limit and shared 20-call limit bound these calls. No live
provider or Devin session has been validated without credentials.

The standalone CLI uses the same named-model catalog as the frontend. Supply
`role_models` in the demo input JSON with all five role IDs mapped to catalog
IDs, for example `"critic": "gemini/gemini-2.5-pro"`. Without assignments,
all roles use the catalog default. There are no separate custom endpoint or
research/proof model environment settings. Model transports require token
usage; Devin instead reports ACU usage.

Install **Lean 4.19.0** through elan or the official binary release. A blank
`SWARM_LEAN_BIN` automatically detects the pinned elan toolchain on macOS,
Linux, and Windows (including a custom `ELAN_HOME`), then the local Windows
binary at `.data/lean/lean-4.19.0-windows/bin/lean.exe`, then `lean` on PATH.
The PATH fallback pins elan to the project's toolchain even when proofs are
compiled in temporary directories. For another installation, set
`SWARM_LEAN_BIN` to its executable path; relative paths resolve from the worker's
working directory. An explicit invalid path reports a verification failure.
The demo uses `Std` and does not require the imported backend's Mathlib project.

## Standalone live demo

```powershell
pnpm swarm:demo
```

This calls real configured models and real Lean, but needs no MongoDB, Redis,
Docker or web server. It investigates whether adding the same natural number
preserves order, using an application-fixed formal target. Progress is printed
and artifacts are written under `.data/swarm-runs/<episode>/`, including
`input.json`, `journal.json`, its write-ahead log, `result.json`, and `Proof.lean`.
The final artifact is a Lean proof term plus the writer's explanation; no
publication-quality paper/LaTeX proof is generated yet.

To resume, use the SAME `SWARM_EPISODE_ID`, input and model configuration.
Completed agent calls replay from the upstream journal. The verifier runs
again. Changing input requires a new ID. An interrupted Redis job is not
automatically reclaimed: this branch does not implement durable queue recovery.

The small theorem is an orchestration demonstration, not evidence that several
agents outperform one model on elementary arithmetic. Evaluate that claim on a
larger set at equal model/token budgets before making it in the presentation.

## Browser demo

Start Docker Desktop, then in separate terminals:

```powershell
pnpm db:up
pnpm research:api
pnpm research:worker
pnpm --filter web dev
```

Open the dashboard, click **New research**, assign a model to each role,
and click **Use example**. Submit the filled goal and exact Lean target. The episode page displays
live role activity, reports, critique revisions, repair decisions, the research
graph and the checked proof. OpenAlex failure is recorded and degrades to
uncited mathematical reasoning; model access and Lean have separate failure
states. The proof-attempt budget is clamped to 1–6; other calls are bounded
separately.

## Run as a native WorkSwarm skill

Use the pinned WorkSwarm repository/release and its installation guide. Its
current console commands retain the `jiuwenswarm-*` prefix.

1. Copy the entire `swarm-skills/math-research` folder into the native host's
   global skill library (`~/.jiuwenswarm/agent/workspace/skills/`, or the library
   under your configured `JIUWENSWARM_DATA_DIR`). Preserve sibling scripts.
2. Configure your model and make `lean` available to the backend process, or
   export `SWARM_LEAN_BIN` before starting it.
3. Enable SwarmFlow, set a team token budget, and open a fresh team session.
   In the TUI: `/swarmflow on --budget 60000`, then `/new`.
4. Ask the Leader to use `triviality-math-research` and call
   `swarmflow(script_path="<absolute skill path>/scripts/workflow.py", args=...)`
   with the example arguments in `SKILL.md`. Do not ask it to regenerate the
   script. Watch `/swarmflows` for real team execution.

The embedded workflow's local `SWARM_*` model transport settings are not the
native host's provider configuration. Optional script model names must exist
in that host. Native token budgets/permissions remain host-owned.

## Challenge evidence

| Requirement | Concrete implementation |
|---|---|
| Role specialization | Coordinator, constructive/skeptical researchers, critic, proof writer |
| Communication | Both reports go to critic; critique and colleague evidence return to researcher; reviewed evidence goes to writer |
| Parallel collaboration | Upstream `parallel()` runs two independent investigations |
| Dynamic adaptation | Reassignment after failure; revise/stop/formalize decision; checker-driven repair |
| Tools and verification | OpenAlex retrieval and real Lean invocation with axiom audit |
| Complete scenario | Checked-in theorem demo; terminal artifacts and browser progress |
| Failure handling | Bounded retries, model timeouts, missing-literature degradation, missing-checker candidate |
| Reusability | Portable team skill, schemas, replaceable backend, framework journal |

## Verification and limitations

Run `pnpm swarm:test`. Tests use **scripted model responses** with the real
SwarmFlow engine. When Lean is detected they also run the real Lean
failure/repair cycle, blank-setting regression, and false-theorem rejection.
They are not live model-quality evaluations. Type-check:

```powershell
pnpm --filter @triviality/database build
pnpm --filter @triviality/research-worker build
pnpm --filter @triviality/research-api typecheck
pnpm --filter web exec next typegen
pnpm --filter web typecheck
```

- `verified`: the unchanged user-supplied formal target passed Lean and the
  allowed-axiom audit. This does not independently establish that the user's
  formal statement captures their intended natural-language problem.
- `formalized`: a model-generated statement passed Lean; translation review
  remains necessary. The episode is not labelled verified.
- `candidate`: no checked proof within the attempt limit, or Lean unavailable.
- `blocked`: investigators/critic could not support proceeding.

The verifier accepts a conservative subset of Std proofs. It is not an OS
sandbox; isolate it before public multi-tenant deployment. Token accounting
can overshoot by in-flight calls and does not enforce a dollar budget. There
is no automatic literature novelty certification, global search tree, Jev
ranking, native-provider adapter for every model, or fully automatic queue
crash recovery. These are explicit boundaries, not simulated features.

## Sources

- [Official WorkSwarm/JiuwenSwarm repository](https://github.com/openJiuwen-ai/jiuwenswarm)
- [SwarmFlow API and host guide](https://github.com/openJiuwen-ai/jiuwenswarm/blob/develop/docs/en/TUISwarmFlowGuide.md)
- [Swarm Skill format](https://github.com/openJiuwen-ai/jiuwenswarm/blob/develop/docs/en/SwarmSkills.md)
- [Lean 4.19.0 release](https://github.com/leanprover/lean4/releases/tag/v4.19.0)
- Track requirements: user-supplied Hack the North 2026 challenge brief.

Provider adapter references: [Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai), [DeepSeek API](https://api-docs.deepseek.com/), [Devin sessions](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions).
