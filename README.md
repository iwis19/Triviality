# MathLab — a Devin-driven laboratory for open mathematical problems

MathLab maintains a source-backed atlas of reported open problems across mathematics, runs
bounded Devin research assignments against them, keeps the resulting hypotheses / experiments /
proof attempts as a versioned lineage graph, culls and refines branches generation by generation,
independently checks Lean proofs, and publishes everything automatically with explicit evidence
labels. The full design is in [`docs/plan.md`](docs/plan.md).

```
frontend/   React + react-force-graph-3d explorer (public browsing + private research controls)
backend/    FastAPI system of record: atlas, campaigns, scheduler, Devin adapter, Lean checker,
            publication projection, public/private/worker APIs
lean/       Lean 4 project the independent checker compiles submissions against
docs/       plan.md — the approved research & implementation plan
```

## Principles the code enforces

- **The app is the system of record; Devin does bounded work.** A graph node is not a Devin
  session. Sessions are `Attempt`s with a frozen prompt, a requested mode and the mode the
  provider actually reported; the app owns scheduling, ingestion, selection and publication.
- **Nothing a worker says is trusted.** Worker-reported evidence is published as
  *"Worker-reported … — not independently certified"*. Only the independent Lean checker (or a
  human reviewer via the private API) can certify evidence; only the checker can grant
  **Lean verified**, and only for the exact approved theorem target with no `sorry`/`sorryAx`
  and no axioms outside the allow-list. A changed statement is a new claim version and never
  inherits verification.
- **Informal proofs are welcome and labelled.** *"Informal proof candidate — not formally
  verified"* is a first-class public label; Lean remains the end goal.
- **Public reads never spend money.** `/public/*` serves only the `Publication` projection
  (allow-listed payloads) and can't create sessions. `/private/*` needs an owner/collaborator
  `X-API-Key`; `/worker/*` needs an attempt-scoped `X-Worker-Token`.
- **"Open" is a dated claim by a source, not a fact.** Every problem carries
  `SourceAssertion`s (URL, location, asserted status, retrieval date, review state). Seed
  records are marked `unreviewed` until a person confirms them.
- **Four relation layers stay separate:** `atlas` (classification), `lineage` (research
  parent/child), `dependency` (idea→claim, proves), `association` (thematic). 3D geometry is
  presentational, never mathematical distance.

## Quick start (mock provider — consumes no Devin usage)

Backend (Python 3.10+):

```bash
cd backend
pip install -e ".[dev]"
MATHLAB_OWNER_API_KEY=dev-owner-key uvicorn app.main:app --reload --port 8000
```

Frontend (Node 22+):

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies /public and /private to :8000
```

Then in the UI click **Research controls**, enter `dev-owner-key`, **Load seed atlas**, create
a portfolio and a campaign, and press **Run scheduler tick** a few times. The mock provider
returns deterministic role-dependent structured output, so you can watch generations branch,
get culled and promoted without spending anything. `curl` equivalent:

```bash
K='X-API-Key: dev-owner-key'
curl -X POST -H "$K" localhost:8000/private/seed
PF=$(curl -s -X POST -H "$K" -H 'Content-Type: application/json' \
     -d '{"name":"pilot","max_concurrent_sessions":2}' localhost:8000/private/portfolios | jq -r .id)
PR=$(curl -s localhost:8000/public/problems/goldbach-conjecture | jq -r .problem.record_id)
curl -X POST -H "$K" -H 'Content-Type: application/json' \
     -d "{\"portfolio_id\":\"$PF\",\"problem_id\":\"$PR\",\"session_budget\":10,\"default_mode\":\"fusion\"}" \
     localhost:8000/private/campaigns
for i in $(seq 30); do curl -s -X POST -H "$K" localhost:8000/private/scheduler/tick >/dev/null; done
curl -s localhost:8000/public/graph | jq '.links | group_by(.layer) | map({(.[0].layer): length})'
```

Or with Docker: `docker compose up --build` (backend on :8000, frontend on :5173).

## Turning on real Devin sessions

Set these (environment or `backend/.env`; never commit the key):

| Variable | Meaning |
|---|---|
| `MATHLAB_DEVIN_PROVIDER=api` | switch from `mock` to the Devin v3 cloud API |
| `MATHLAB_DEVIN_API_KEY` | organization service-user API key |
| `MATHLAB_DEVIN_ORG_ID` | organization id used in `POST /v3/organizations/{org}/sessions` |
| `MATHLAB_DEVIN_CREATE_AS_USER_ID` | optional; attributes sessions to that user's plan |
| `MATHLAB_DEVIN_MAX_ACU_LIMIT` | optional per-session ACU cap |
| `MATHLAB_PUBLIC_BASE_URL` | URL Devin sessions can reach to call `/worker/*` back |
| `MATHLAB_SCHEDULER_ENABLED=true` | run the scheduler loop in-process every `MATHLAB_SCHEDULER_INTERVAL_SECONDS` |
| `MATHLAB_OWNER_API_KEY` | **change from the default before exposing the API** |

Modes (`normal`, `fast`, `lite`, `ultra`, `fusion`) are passed through verbatim as `devin_mode`
and stored as `requested_mode`; whatever the API reports back is stored separately as
`reported_mode`. Nothing is silently downgraded. Per-assignment mode choice and a
`comparison_group` tag support the Fusion-vs-Ultra pilot from the plan (§6.4).

With a live provider every scheduler tick may create sessions billed to the attributed account;
the UI shows a warning when the provider is not `mock`.

## Lean checker

`lean/` is a minimal Lake project (toolchain in `lean/lean-toolchain`). Install
[elan](https://github.com/leanprover/elan), then `cd lean && lake build`. The checker:

1. statically rejects `sorry`, `sorryAx`, `axiom`, `unsafe`, `implemented_by`, `extern`,
   `native_decide`, and any declaration whose name/signature differs from the approved target;
2. compiles the submission inside the project and runs `#print axioms` on the target;
3. records toolchain, project hash, elapsed time and full log as `Evidence.details`.

If Lean is not installed the checker records a `checker_unavailable` blocker; it never
pretends to verify. `MATHLAB_LEAN_PROJECT_DIR=""` disables it explicitly.

## Development

```bash
cd backend && ruff check app tests && ruff format --check app tests && mypy app && pytest
cd frontend && npm run typecheck && npm run build
```

The backend suite includes a real Lean round-trip (skipped when the toolchain is absent).
SQLite is the default database; set `MATHLAB_DATABASE_URL` to a PostgreSQL URL for deployment.

## API surface

| Prefix | Auth | Purpose |
|---|---|---|
| `GET /public/areas, /problems, /problems/{slug}, /ideas/{id}, /graph, /events, /labels` | none | published projection only |
| `POST /private/seed, /problems, /portfolios, /campaigns, /campaigns/{id}/assignments, /scheduler/tick …` | `X-API-Key` | research controls (owner or collaborator) |
| `POST /private/collaborators, /publications/{id}/withdraw` | owner key | account and retraction controls |
| `GET /worker/attempts/{id}/context`, `POST /worker/attempts/{id}/submit` | `X-Worker-Token` | what a Devin session calls back into |

## Status

Phase 0–1 of the plan: atlas + research loop + Lean checker + automatic publication + 3D
explorer, validated against the deterministic mock provider. Not yet done: live Devin pilot
runs, MCP tool server for in-session callbacks, source review workflow UI, PostgreSQL
deployment manifests, and the adapters for external evolution engines listed in the plan.
