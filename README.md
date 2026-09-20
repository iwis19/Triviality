# Triviality

## Included backend

`external/norththehackers/` contains regular files tracked by this repository,
imported from `sharonbasovich/norththehackers` main at
`04b9875ab1f0e50e0f20a1ab68ff3dfaa01f6883`. A normal clone includes the backend,
explorer, Lean project, and research snapshots; no submodule setup is required.

See [backend setup and commands](docs/backend.md). After installing its Python
dependencies, `pnpm backend:dev` starts the imported API on port 8000. The
existing Triviality dashboard continues to use the research API on port 3010
described below.

## WorkSwarm research team

The **WorkSwarm** orchestration layer runs three independent research branches
in parallel exploration rounds, with a searchable literature bank, persistent
discovery bank, substantive challenger feedback, and fresh starts after refutation
or stagnation. A coordinator selects alternative foundations; a proof writer
formalizes reviewed candidates and Lean feedback returns to research. Configure
exploration rounds, stagnation threshold and proof attempts separately in the
dashboard. See [the exploration protocol](swarm-skills/math-research/workflow.md)
and [setup, demo, and challenge mapping](docs/openjiuwen-challenge.md).
The skill lives in [swarm-skills/math-research](swarm-skills/math-research/SKILL.md).
After setup, `pnpm swarm:demo` runs a live terminal demo and `pnpm swarm:test`
runs deterministic collaboration tests with real Lean checks when installed.

## Data layer

The research schema is MongoDB-native. `packages/database` defines typed collections for research state, mathematical knowledge, graph nodes and relationships, raw object-storage artifacts, and paper embeddings. MongoDB Atlas Vector Search indexes `paper_embeddings.embedding`; Redis tracks ingestion jobs.

Start the local MongoDB and Redis services, then run:

```bash
docker compose up -d mongodb redis
cp .env.example .env
pnpm --filter @triviality/database ensure-indexes
pnpm papers:ingest
```

Convenience commands are also available: `pnpm db:up`, `pnpm db:status`, and `pnpm db:down`.

The local database is available at `mongodb://localhost:27017`, database `triviality`. Atlas can be used later by replacing `MONGODB_URI` in `.env`.

The paper ingestion worker ranks mathematics-related OpenAlex works by citation count, stores normalized metadata and raw JSON artifacts, creates paper graph nodes, and writes embeddings when `EMBEDDING_API_KEY` is configured. OpenAlex is used for ranked discovery; arXiv/PDF URLs are retained as source links when supplied by the record.

The default discovery catalog covers 16 areas and requests up to 100 works per area: algebra, analysis, geometry, topology, number theory, combinatorics, probability, statistics, logic, differential equations, numerical analysis, optimization, dynamical systems, mathematical physics, category theory, and representation theory. Results are deduplicated by OpenAlex work ID; per-area rank and provenance are stored in `paper_discoveries`.

## Local research runtime

An optional [Challenger experiment worker](docs/experiment-worker.md) runs bounded
exact-arithmetic searches on a Vultr VM and feeds evidence back into the research
workflow. See the guide for deployment, credentials, and local tests.

Run `pnpm experiments:demo` for a self-contained execution demo. Deploy once with
`pnpm experiments:setup root@YOUR_VM_IP`; subsequent demos automatically use
Vultr. `pnpm experiments:worker` starts the research worker with its experiment
connection, including the SSH tunnel.

The research workspace is backed by two additional apps:

- `apps/research-api` — creates research episodes, stores their state in MongoDB, and enqueues work in Redis.
- `apps/research-worker` — retrieves OpenAlex literature, runs the openJiuwen SwarmFlow research team with per-role models and independent Lean checks, and writes graph nodes, attempts, results, and artifacts back to MongoDB.

WorkSwarm orchestrates every research episode. Choose a model or Devin agent for each role in the dashboard. Credentials stay server-side; see [provider setup and challenge notes](docs/openjiuwen-challenge.md). Devin runs only when assigned to a role, and its structured findings feed the shared workflow.

Run the services in separate terminals:

```bash
cp .env.example .env
pnpm db:up
pnpm research:api
pnpm research:worker
pnpm --filter web dev
```

The web app proxies `/api/research/*` to `RESEARCH_API_URL` (default `http://localhost:3010`). A research job is not considered verified because a model says it is: when Lean is unavailable or rejects the generated file, the episode remains a candidate/blocked result and the checker detail is shown in the episode page. Install Lean 4.19.0 through elan for automatic detection, or set `SWARM_LEAN_BIN` to another installation as described in the challenge notes. A blank setting uses automatic detection; it does not disable compilation.
