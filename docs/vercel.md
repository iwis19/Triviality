# Vercel deployment

The production dashboard is deployed at https://triviality-psi.vercel.app in
the `triviality/triviality` Vercel project. The dashboard proxies to the authenticated
HTTPS API at `https://155-138-157-87.sslip.io`. Production `RESEARCH_API_URL` and
the secret `RESEARCH_API_KEY` are configured in Vercel.

Deploy the Next.js dashboard as a Vercel project with **Root Directory**
`apps/web`. Keep **Include source files outside of the Root Directory** enabled
so Vercel can use the root pnpm workspace and lockfile. The app's `vercel.json`
sets the Next.js framework, frozen pnpm install, and production build command.

From the repository root, authenticate and link the Vercel project:

```powershell
pnpm dlx vercel login
pnpm dlx vercel link
```

Set the project's Root Directory to `apps/web` in Vercel before deploying.
Configure `RESEARCH_API_URL` in the project's Production environment to the
reachable HTTPS research API origin, without a trailing slash. Also configure
Preview if preview deployments should access that backend. Then deploy the
current local source, including uncommitted changes:

```powershell
pnpm dlx vercel deploy --prod
```

## Backend wiring

The dashboard sends browser requests to its same-origin `/api/research/*` and
`/api/public/*` routes. These server-side routes forward to `RESEARCH_API_URL`.
`localhost:3010` on Vercel does not reach a laptop or VM.

The research API, Redis queue, MongoDB, and long-running research worker run on
`155.138.157.87` under `/root/triviality-backend`, using `deploy/vm/compose.yml`.
MongoDB and Redis bind only to loopback and use persistent Docker volumes.
The existing private experiment/Lean service remains on `127.0.0.1:8090`.
The API gateway uses Caddy-managed TLS and checks the server-side bearer key.
Only SSH, HTTP (certificate validation/redirects), and HTTPS are allowed by UFW.

The inaccessible Atlas connection is no longer a production dependency. The
bundled `mathlab-2026-09-19.db` snapshot was imported: 71 areas, 1,126 problems,
3,252 relations, 383 claims, 3,399 publications, and 5,605 public events.
Research jobs from the old Atlas account were not recovered. Atlas-only vector
search indexes are not available on this standalone MongoDB installation.

On the backend host, configure the shared MongoDB and Redis connections, model
credentials, Python research runtime, and `TRIVIALITY_URL` with the deployed
dashboard URL. A research worker on the experiment VM can use
`EXPERIMENT_API_URL=http://127.0.0.1:8090` and
`LEAN_API_URL=http://127.0.0.1:8090`, with the existing experiment secret in both
key settings. A worker on another host needs a persistent private connection.
Keep these credentials on the backend host, not in browser variables.

Keep Vercel deployment protection enabled: the dashboard does not implement
user accounts. The backend origin requires a secret bearer key for all requests;
the Next.js routes supply it, without exposing it to browser JavaScript.

## Updating the VM

`node scripts/stage-vm.mjs` prepares source and private runtime configuration in
ignored `.data/vm-deploy`. The staging directory contains secrets: upload only
over SSH to this VM; never commit it or publish it as an artifact. Preserve the
saved `api-key` when restaging. Archive the staging directory, upload/extract it
under `/root/triviality-backend`, then run from that remote directory:

```sh
docker compose -f deploy/vm/compose.yml build api
docker compose -f deploy/vm/compose.yml up -d
```

Container restart policies keep services running after SSH disconnects and VM
reboots. Initial MongoDB backup: `/root/triviality-backend/backups/initial-atlas.archive.gz`.

The HTTPS gateway retries failed upstream connections for up to 15 seconds to
cover brief API container replacement gaps. This is not a zero-downtime rollout:
longer outages still return an error. Dashboard polling clears a previous error
after the next successful response.

## Verification

Research budget changes require deploying **both** the Next.js dashboard and
the VM API/worker image. A dashboard-only deployment cannot change the worker's
token limit. New jobs persist `tokenBudget`, which the worker forwards as
`token_budget`; verify the saved job and `.data/swarm-runs/<episode>/input.json`
agree with the value selected in the form. Historical runs keep their original
budget and result. The default remains 60,000; a higher limit must be selected
when starting a new run.

1. `pnpm --filter web build` must pass.
2. Check the hosted research API's `/health` endpoint.
3. Check `/api/research/jobs` and `/api/public/areas` through the Vercel URL.
4. Start a research episode and verify the backend worker processes it and
   returns experiment/Lean results before calling the deployment fully wired.

The root `.vercelignore` excludes local secrets, VM data, Python environments,
and backend-only source from CLI uploads.
