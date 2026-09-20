# Experiment worker: quick start

## Demo — one command

```bash
pnpm experiments:demo
```

Starts the service or tunnel, handles credentials, runs two real searches, prints
results, and closes the connection. Before Vultr setup this runs locally (project
Python environment or Python on PATH). After setup it uses your saved Vultr VM.
Use `pnpm experiments:demo --local` to explicitly run locally.

The demo tests whether n²+n+41 is always prime. Searching 0–39 finds no
counterexample (not a proof); searching 0–100 finds n=40 and 1681=41×41.
This is a deterministic worker demo with preset requests, not a live Challenger
or Lean proof. No model keys or model tokens are needed. Job IDs persist and
repeated requests reuse saved results; displayed execution times are recorded times.

## Vultr — one-time setup

Create an Ubuntu 24.04 VM and attach your SSH key in Vultr. Allow SSH from your
IP; leave port 8090 closed publicly. For this worker alone, 1 vCPU and 1–2 GB RAM
is a starting estimate. Then run from your local project:

```bash
pnpm experiments:setup root@YOUR_VM_IP
```

Uploads service files, generates the secret, installs Docker/Compose if missing,
builds the service, and waits for health. No manual copying, environment edits,
or separate SSH tunnel terminal. A non-root VM user needs passwordless sudo.
Your laptop needs Node/pnpm, ssh, scp, and tar. The VM needs internet for setup.
SSH may ask for host confirmation/authentication; SSH keys avoid repeated passwords.

Files live in ~/triviality-experiments on the VM. Local connection details and
secret live in ignored .data/experiment-launcher/connection.json; keep it private.
Rerun setup to deploy updates: it reuses the same host's saved key and preserves
results. Avoid deploying from multiple laptops with different saved keys.

After setup, **pnpm experiments:demo uses Vultr automatically**.

## Connect the live research team

Replace your usual research-worker command with:

```bash
pnpm experiments:worker
```

This manages the connection/tunnel, builds and starts the research worker, and
passes credentials directly to its environment. Ctrl+C stops both. The database,
Redis, research API/dashboard, Python/SwarmFlow and model credentials still use
the normal project setup; this does not launch the entire application.
Restart this command after changing worker code. Start a new research episode
when changing experiment settings because agent journal call order changes.

The Challenger plans an optional experiment before its review. This adds one
model call per reviewed branch per round under the existing token budget. The
result feeds its review and the shared discovery bank. Unsupported tasks can be
skipped. Manual EXPERIMENT_API_URL / EXPERIMENT_API_KEY settings remain supported;
leaving the URL empty in the normal research worker disables experiments.

## Scope

The worker checks integer-polynomial properties: prime, nonnegative, positive,
and zero. Coefficients are constant-first, bounds inclusive. Example request:

```json
{"coefficients":[41,1,1],"start":0,"end":100,"property":"prime"}
```

Maximum degree 8, coefficient magnitude 10^6, inputs within +/-10000 and at most
10001 inputs. Primality values are limited to magnitude 10^9. No arbitrary code,
expression strings, paths or model-selected URLs are accepted.

Results distinguish counterexample_found, no_counterexample_in_bounds, and
execution_error. All have verified:false. The Challenger must confirm a witness
matches the original domain and assumptions. Automatic Lean disproof generation
and hosted Lean checking remain separate work.

Docker provides a six-second computation deadline, Linux CPU/address-space
limits, non-root/read-only execution, bounded memory/processes and an internal
network without external egress. A loopback Caddy gateway is accessed over SSH.
Local Python demos lack container isolation. SQLite stores requests/results by
hash and engine version; interrupted jobs rerun on resubmission. Completed errors
are cached too. This is a synchronous private single-worker service, not a
public multi-tenant job queue. Back up the results volume consistently with SQLite.
Closing the local launcher leaves the remote service running; VM billing continues.

## Tests

Use the project Python environment:

```bash
python -m unittest discover -s apps/experiment-worker -p 'test_*.py' -v
python -m unittest discover -s apps/research-swarm/tests -p 'test_*.py' -v
```

Coverage includes witnesses, bounds, invalid input, authentication, failures,
caching, recovery and real HTTP handoff to scripted Challenger review. The local
one-command demo and Linux Docker request path have been exercised. The user
has also completed Vultr setup and run the remote deterministic demo. Live
model-driven Challenger validation against the VM remains outstanding.
