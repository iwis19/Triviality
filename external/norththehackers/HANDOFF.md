# HANDOFF — resuming the lab from a fresh Devin account / machine

Read this first. Goal: get the MathLab research loop running again, from the last committed
state, with real Devin sessions billed to the *new* account. Nothing below needs the old
account or the old VM.

## 0. What is where

| Thing | Location | In git? |
|---|---|---|
| Code (backend, frontend, Lean project) | this repo, `main` | yes |
| Plan and pilot notes | `docs/plan.md`, `docs/pilot-fusion-vs-ultra.md` | yes |
| Research state at handoff (27 Lean-verified sub-results, 53 campaigns, 143 attempts, 230 ideas, 1126 atlas problems incl. all 642 open Erdős problems) | `snapshots/mathlab-2026-09-19.db` + `snapshots/artifacts/` | yes |
| One-day sprint notes, triage list and local search scripts | `snapshots/sprint-2026-09-19/`, section 7 below | yes |
| Secrets (`backend/.env`) | **not** in git; recreate (step 1) | no |
| Devin API key/org of the old account | old account only; do **not** reuse | no |

At the 2026-09-19 18:15 UTC handoff all 43 in-flight provider sessions were deleted via the API
and their attempts marked `timed_out`; every campaign was set to `paused`. Nothing is running
and nothing bills anyone until campaigns are un-paused (`POST /private/campaigns/{id}/state?state=active`).

## 1. Secrets the new Devin session must have (ask the user once, up front)

Already stored as **org-scoped secrets** in the `mathdiscovery` Devin org (`MATHLAB_DEVIN_API_KEY`,
`MATHLAB_DEVIN_ORG_ID`, `MATHLAB_OWNER_API_KEY`); a session in that org just uses them. For a
different account create them again:

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

Portfolios in the snapshot (all paused at handoff, all `max_concurrent_sessions=32`):

- `autonomous-1` / `erdos-autonomous`: the original famous-problem campaigns (union-closed,
  Hadwiger–Nelson, Goldbach, kissing number d=5, Erdős #376, #7, #141, #1142), budgets raised to
  100000.
- `sprint`: one successor campaign per problem above; the famous-problem ones were paused
  deliberately to concentrate on tractable targets, #376/#1142 kept.
- `tractable`: two campaigns (seed 1 and 2) for each of 16 neglected, concrete Erdős problems
  chosen from the full open catalog: #686, #835, #647, #677, #699, #488, #307, #396, #727,
  #389, #289, #261, #274, #1056, #287, #97. This is where the effort should continue.

Campaign policy in force: `max_acu_limit=25`, `role_acu_limits.prover_formalizer=40`,
`ideas_per_generation=4`, `default_mode=ultra`. `auto_plan` continues generations *within* a
campaign but does **not** create successor campaigns (contrary to the earlier note); a campaign
at its `session_budget` stops. Also only one attempt is in flight per campaign
(`Scheduler.plan`), so parallelism = number of active campaigns, not portfolio slots.

Only `lean_check`/`verified` evidence rows carry the "Lean verified" label;
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
- Sprint settings used on 2026-09-19: `MATHLAB_DEVIN_MAX_ACU_LIMIT=25`,
  `MATHLAB_SCHEDULER_INTERVAL_SECONDS=45`.

## 7. One-day sprint (2026-09-19): goal, triage and what was found

Goal set by the user: solve at least one open problem, preferring obscure/neglected but concrete
problems over famous ones. No open problem is solved yet. State of play:

- Full open Erdős catalog imported (`POST /private/atlas/import/erdos`, 642 problems, 385 with
  reference Lean statements). Triage export: `snapshots/sprint-2026-09-19/erdos_open.txt`.
- Lab notes for workers were written into `problems.assumptions` for #686, #835, #647, #677,
  #699, #488 (they appear in every worker prompt). Key ones, all **unverified sketches**:
  - **#686** (every N≥2 as a ratio of products of k consecutive integers, m≥n+k): with k=2 and
    x=2m+3, y=2n+3 the equation is x²−Ny²=1−N; from the trivial solution (1,1) times powers of the
    fundamental unit of x²−Ny²=1 one gets infinitely many solutions with x,y odd and x≥y+4 for
    every **non-square** N (checked by hand for N=2,3; parity works for odd N directly, for even N
    use the square of the unit). So the open content is square N. Local search: 9=26·27·28/(12·13·14),
    16=14·15·16/(5·6·7), but **no representation of N=4 or N=25 with k≤12 and n<10⁶**
    (`search686.py`, `search686b.py`). Best next steps: Lean-formalize the non-square case;
    decide N=4 (it is equivalent to C(a,k)=4·C(b,k) with a≥b+k); the k=3 case is the elliptic
    curve 4(u³−u)=v³−v.
  - **#835**: a valid colouring is a proper (k+1)-colouring of the Johnson graph J(2k,k); each
    colour class is a constant-weight code of distance 4, so has ≤C(2k,k−1)/k elements, forcing
    every class to be a Steiner system S(k−1,k,2k). Hence the question is equivalent to the
    existence of a large set LS(k−1,k,2k): k=3 impossible (no S(2,3,6)), k=5 impossible
    (divisibility), k=4 / k=6 reduce to 5 disjoint SQS(8) / 7 disjoint S(5,6,12) — check the
    large-set literature (Kramer–Mesner, Teirlinck, Etzion); the k=3 impossibility is finite and
    Lean-decidable.
  - **#647**: no n in (24, 2·10⁸] (`search647.c`). **#677**: no coincidence M(n,k)=M(m,k),
    m≥n+k, for 2≤k≤12, n<3·10⁵ (`search677.py`). **#699**: holds for all n≤3000
    (`search699.c`). **#488**: no counterexample among small A (`search488.py`).
- Worker output on the tractable set so far (see ideas/evidence in the DB, `monitor.py` prints
  a digest): Lean-verified sub-lemmas for #677 (k=2 case, elementary sieve bounds), #699
  (Kummer criterion + concrete instances), #389, #727 (carry-budget reformulation), #307
  (arithmetic-derivative reformulation); literature checks found all 16 still open as of
  2026-09-19 (#699: i=2 and n=2j cases known; #274: Herzog–Schönheim, Sun 2004 for subnormal
  subgroups).

To resume: restore the snapshot (step 3), start the stack (step 4), un-pause the `tractable`
portfolio campaigns first (`POST /private/campaigns/{id}/state?state=active`) and set
`MATHLAB_DEVIN_MAX_ACU_LIMIT=25`. Everything else in the atlas (642 open Erdős problems) is
available for new campaigns via `POST /private/campaigns`.
