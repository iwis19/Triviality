---
name: testing-triviality
description: How to run and end-to-end test the Triviality monorepo (web :3000, research-api :3010, research-worker, Mongo/Redis) plus the bundled MathLab explorer (:5173) and backend (:8000) under external/norththehackers/.
---

# Testing the Triviality monorepo + bundled MathLab

Repo root: pnpm/turbo monorepo. MathLab (pre-monorepo app) lives at `external/norththehackers/` (backend + frontend explorer + lean project).

## Services to start (all from repo root)

```bash
docker compose up -d mongodb redis        # or: pnpm db:up
pnpm install                              # first time only
pnpm research:api                         # :3010 Fastify (needs Mongo+Redis)
pnpm --filter web dev                     # :3000 Next.js dashboard
pnpm research:worker                      # pops triviality:research:jobs from Redis
# MathLab (separate, still working post-move):
(cd external/norththehackers/backend && python3 -m uvicorn app.main:app --port 8000)
(cd external/norththehackers/frontend && npm run dev)   # :5173, vite proxies /public,/private,/health -> :8000
```

## Critical gotchas discovered while testing

- **research-worker spawn**: `apps/research-worker/src/swarm.ts` spawns `SWARM_PYTHON` or `<repo>/.venv/bin/python`. No `.venv` exists in fresh checkouts — start the worker as `SWARM_PYTHON="$(which python3)" pnpm research:worker` (empty `SWARM_PYTHON=` in .env is falsy and falls back to `.venv`; an env var passed on the command line survives dotenv).
- **SwarmFlow engine is not vendored**: `runner.py` dies at `runtime.load_engine()` ("Run python apps/research-swarm/setup_runtime.py first") until you run `python3 apps/research-swarm/setup_runtime.py` once (git-fetches a pinned engine into `.data/swarmflow-runtime`). Without it, jobs fail with the setup error instead of the model-key error.
- **Python deps for swarm**: runner needs `jsonschema` + `aiofiles` in the python used for `SWARM_PYTHON` (`pip install jsonschema aiofiles`).
- **Missing model keys** (OPENAI_API_KEY etc. blank in .env): jobs still POST fine (202, queued), the worker fails them at `runner.py` preflight with "Configure OPENAI_API_KEY and the selected model in the worker environment" -> episode ABANDONED -> dashboard shows "Research failed." + error box. This is the expected graceful path — a completing episode needs real provider keys.
- **Lean detection** (`swarm-skills/math-research/scripts/lean_check.py`): with `SWARM_LEAN_BIN` blank it probes `~/.elan/toolchains/leanprover--lean4---v4.19.0/bin/lean` (the pinned toolchain), then PATH. `elan toolchain install leanprover/lean4:v4.19.0` enables end-to-end `check()` runs; Std is bundled so `import Std` + `by omega` verifies without lake.
- **Explorer private panel**: "Research controls" button -> password input. Send the owner key as-is (it's posted as `X-API-Key` to :8000 `/private/*`); wrong/absent key -> "Authentication failed" / `{"detail":"Missing X-API-Key"}`. Public browsing needs no key.
- **3D graph node clicks**: nodes drift (live force layout). Hover first — a `<type> · label` tooltip confirms you're on a node — then click. Clicking the already-selected hub leaves the detail panel unchanged (looks like a miss but isn't).
- **Next.js proxy**: `/api/research/jobs*` route handlers forward to `RESEARCH_API_URL` (default `http://localhost:3010`). Verify writes by curling `localhost:3010/research/jobs` — the browser never talks to :3010 directly.

## Golden test flow (recorded, ~5 min)

1. :3000 -> landing -> /dashboard -> sidebar Overview/Research graph/Literature (empty states when DB empty).
2. "+ NEW RESEARCH" -> "Use example" -> "Start research" -> `/dashboard/research/episode_*` shows running stage -> worker fails it -> "Research failed." + red error box; Overview row shows FAILED pill.
3. :5173 -> 3D graph renders (~1800 nodes) -> "List view (l)" -> click area row -> click problem row -> detail panel (statement, Lean formal target, sources, research tree) -> "3D view (l)" back -> click node -> panel updates.
4. "Research controls" -> owner key -> Connect -> "provider mock" status + portfolios/campaigns -> "Run scheduler tick" returns JSON.

## Devin Secrets Needed

- `MATHLAB_OWNER_API_KEY` — private panel auth on :8000.
- `MATHLAB_DEVIN_API_KEY` / `MATHLAB_DEVIN_ORG_ID` — only for live (non-mock) backend provider; mock needs neither.
- Model provider keys (OPENAI_API_KEY/GEMINI_API_KEY/...) — only needed to test an episode completing; absent => expect the graceful-failure path above.
