# HANDOFF — resuming the lab from a fresh Devin account / machine

Read this first. Goal: get the MathLab research loop running again, from the last committed
state, with real Devin sessions billed to the *new* account. Nothing below needs the old
account or the old VM.

## 0. What is where

| Thing | Location | In git? |
|---|---|---|
| Code (backend, frontend, Lean project) | this repo, `main` | yes |
| Plan and pilot notes | `docs/plan.md`, `docs/pilot-fusion-vs-ultra.md` | yes |
| Research state at handoff (12 Lean-verified sub-results, 12 campaigns, ~40 attempts) | `snapshots/mathlab-2026-09-19.db` + `snapshots/artifacts/` | yes |
| Secrets (`backend/.env`) | **not** in git; recreate (step 1) | no |
| Devin API key/org of the old account | old account only; do **not** reuse | no |

Old-account sessions that are still `running`/`queued` in the snapshot cannot be polled with
the new key; the scheduler times them out when their lease expires (≤ 6 h) and re-plans.
Their finished output, if any, is lost — acceptable.

## 1. Secrets the new Devin session must have (ask the user once, up front)

Create as **permanent repo-scoped secrets** so later sessions don't ask again:

| Secret | Where the user gets it |
|---|---|
| `MATHLAB_DEVIN_API_KEY` | new account → https://app.devin.ai/settings/api-keys (org/service key) |
| `MATHLAB_DEVIN_ORG_ID` | same page |
| `MATHLAB_DEVIN_CREATE_AS_USER_ID` (optional) | the user's id, visible on any session object in the v3 API; attributes sessions to their plan |
| `MATHLAB_OWNER_API_KEY` | any strong random string (this is the lab's private-panel key) |

Also required once, by the user: install the Devin GitHub app for the new account on
`sharonbasovich/norththehackers` (https://github.com/apps/devin-ai-integration → Configure),
otherwise the new session gets 403 on the repo.

## 2. Machine setup (≈10 min, Lean cache is the slow part)

```bash
# Python 3.10+, Node 22+, jq
cd backend && pip install -e ".[dev]" && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..

# Lean toolchain + Mathlib (needed for the independent checker; skip → checker reports unavailable
# and nothing gets "Lean verified", but the rest of the loop still runs)
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh -s -- -y
source ~/.elan/env
cd lean && lake exe cache get && lake build && cd ..   # toolchain pinned in lean/lean-toolchain

# cloudflared (temporary public URL so sessions can call /worker/* back)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o ~/bin/cloudflared && chmod +x ~/bin/cloudflared
```

Validate: `cd backend && ruff check app tests && mypy app && pytest -q` (33 tests; the Lean
round-trip test is skipped if `lake` is absent).

## 3. Restore the research state

```bash
cp snapshots/mathlab-2026-09-19.db backend/mathlab.db
cp -r snapshots/artifacts backend/artifacts
```

## 4. Configure and start

`backend/.env` (gitignored):

```dotenv
MATHLAB_OWNER_API_KEY=<owner key>
MATHLAB_DEVIN_PROVIDER=api
MATHLAB_DEVIN_API_KEY=<new account key>
MATHLAB_DEVIN_ORG_ID=<new org id>
MATHLAB_DEVIN_CREATE_AS_USER_ID=<optional>
MATHLAB_DEVIN_MAX_ACU_LIMIT=5
MATHLAB_SCHEDULER_ENABLED=true
MATHLAB_SCHEDULER_INTERVAL_SECONDS=120
MATHLAB_PUBLIC_BASE_URL=<filled in below>
```

```bash
# 1. tunnel first, because sessions embed this URL in their prompt
nohup ~/bin/cloudflared tunnel --url http://localhost:8000 > ~/tunnel.log 2>&1 &
sleep 8; grep -o 'https://[a-z-]*\.trycloudflare\.com' ~/tunnel.log | head -1   # → MATHLAB_PUBLIC_BASE_URL

# 2. backend (scheduler runs in-process)
cd backend && set -a && source .env && set +a
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > ~/backend.log 2>&1 &
curl localhost:8000/health        # {"ok":true,"provider":"devin-api"}

# 3. frontend
cd ../frontend && nohup npm run dev > ~/frontend.log 2>&1 &   # :5173, proxies to :8000
```

Trigger a tick by hand to confirm sessions are created under the new account:

```bash
curl -s -X POST -H "X-API-Key: $MATHLAB_OWNER_API_KEY" localhost:8000/private/scheduler/tick
```

`reconciled` counts polled sessions, `dispatched` new ones; check the private panel (enter the
owner key) or https://app.devin.ai for the new sessions. Every tunnel restart gives a new URL:
update `MATHLAB_PUBLIC_BASE_URL` and restart the backend.

## 5. Where the campaigns stand

Portfolios in the snapshot: `autonomous-1` (4 concurrent; union-closed, Hadwiger–Nelson,
Goldbach, kissing number d=5) and `erdos-autonomous` (3 concurrent; Erdős #376, #7, #141,
#1142). `auto_plan` is on, so finished campaigns get successors automatically. Campaigns at
their `session_budget` stop dispatching; start a successor with `POST /private/campaigns`
(same `problem_id`, larger `session_budget`) rather than editing the old one. Only the 12 `lean_check`/`verified` evidence rows carry the "Lean verified" label;
everything else is candidate/empirical and no open problem is marked solved — keep it that way:
the label is granted only by `backend/app/services/lean_checker.py`, never by a worker report.

## 6. Operating rules that were in force

- Work on a branch `devin/<unix-ts>-<slug>`, PR into `main`; the user merges (Devin can't).
- Never commit `backend/.env`, `backend/mathlab.db*`, `backend/artifacts/` (snapshot copies go
  under `snapshots/` deliberately), `lean/.lake/`.
- Run the backend check line above before every push; CI runs the same plus the frontend
  `typecheck`/`test`/`build`.
- Devin modes: `ultra` for generation/critique/formalization, `fusion` for experimenter and
  status-research roles (`DEFAULT_POLICY` in `backend/app/services/scheduler.py`).
- The lab runs only while the machine is awake. For always-on hosting the plan is Fly.io
  (one machine, persistent volume for SQLite + Lean cache, secrets as Fly secrets); the user
  has not yet provided a Fly token.
