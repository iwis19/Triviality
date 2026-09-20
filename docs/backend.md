# Imported MathLab backend

The complete source from `sharonbasovich/norththehackers` main at
[`04b9875ab1f0e50e0f20a1ab68ff3dfaa01f6883`](https://github.com/sharonbasovich/norththehackers/commit/04b9875ab1f0e50e0f20a1ab68ff3dfaa01f6883)
is tracked in `external/norththehackers/`. It replaces the submodule previously
pinned at `3c6a9dcb7fd8df4d09b3f18d88d64c86af629493`. Edit and commit these files
directly in Triviality. There is no nested Git repository or automatic upstream
sync. The imported `HANDOFF.md` records historical operations in the source
repository; use the paths and setup below for this repository.

## Local setup

Use Python 3.11–3.13 and Node 22+ with pnpm. From the Triviality repository root:

```bash
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/python -m pip install -e './external/norththehackers/backend[dev]'
```

On Windows use `python` and `.venv/Scripts/python.exe`. An existing `.venv` can
be reused; set `BACKEND_PYTHON` to an absolute Python executable path to use a
different environment. The WorkSwarm runtime has its own additional
[setup instructions](openjiuwen-challenge.md#local-setup).

If `.env` does not exist, copy `.env.example` to `.env`. Configure the
`MATHLAB_*` settings there, then start the backend:

```bash
pnpm backend:dev
```

The launcher loads the root `.env` and starts in the backend directory, so
SQLite, artifacts, and the optional backend-specific `.env` resolve correctly.
Environment variables (including those loaded from the root `.env`) take
precedence over `external/norththehackers/backend/.env`. The default provider is
`mock`, and the automatic scheduler is disabled. No Devin credentials are needed
to try the local research loop. The backend's `MATHLAB_DEVIN_*` credentials are
separate from the research worker's `DEVIN_*` settings.

- API health: <http://localhost:8000/health>
- API documentation: <http://localhost:8000/docs>
- Database: `external/norththehackers/backend/mathlab.db`
- Generated artifacts: `external/norththehackers/backend/artifacts/`

Local databases, artifacts, environments, caches, and dependency directories are
ignored by Git. `pnpm backend:start` runs without automatic reload. Additional
server options can be appended, e.g. `pnpm backend:start --port 8001`.

## Explorer and existing dashboard

The imported explorer uses the imported backend's `/public`, `/private`, and
`/health` APIs. Install and start it from the repository root:

```bash
npm ci --prefix external/norththehackers/frontend
pnpm backend:explorer
```

Open <http://localhost:5173>. In **Research controls**, enter the configured
`MATHLAB_OWNER_API_KEY`, load the seed atlas, and run a mock campaign. The explorer
keeps its own npm lockfile and is outside the root pnpm workspace.

The Triviality Next.js dashboard at port 3000 uses `apps/research-api` on port
3010, MongoDB, Redis, and WorkSwarm. Its existing commands and API contracts are
unchanged. The MathLab backend stores its own data in SQLite; the import does not
migrate that data into MongoDB or replace the dashboard's research workflow.

Alternatively, run the imported backend and explorer together using their
existing Docker setup (the mock provider is the default):

```bash
docker compose --env-file .env -f external/norththehackers/docker-compose.yml up --build
```

This uses its own data volume and does not change the root MongoDB/Redis setup.

## Lean and saved research

The imported Mathlib project uses Lean **4.24.0**. With elan installed:

```bash
cd external/norththehackers/lean
lake exe cache get
lake build
```

This downloads a large Mathlib cache. WorkSwarm's separate Std-only demo uses
Lean 4.19.0. Without a configured checker, MathLab reports `checker_unavailable`;
it does not label unverified results as verified.

The imported `snapshots/` directory includes the upstream database and artifacts.
Restoring them is optional and should be done with the backend stopped and only
after backing up any existing local database. Follow the
[snapshot restore instructions](../external/norththehackers/README.md#restoring-a-research-snapshot)
from inside `external/norththehackers/`.

## Validation

```bash
pnpm backend:check
pnpm backend:test
npm --prefix external/norththehackers/frontend run typecheck
npm --prefix external/norththehackers/frontend test
npm --prefix external/norththehackers/frontend run build
```

Two backend tests use the real Lean/Mathlib project. Install and build it first
when `lake` is on PATH; to run only the backend's other checks, use
`pnpm backend:test -k 'not real_lean'`. Tests use temporary databases and the mock
provider. The root `.github/workflows/backend.yml` runs backend and explorer
checks for future changes; the workflow copied inside the imported directory
remains an upstream reference.
