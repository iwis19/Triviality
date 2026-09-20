/** One-command local/remote demo, provisioning, and managed worker connection. */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const state = join(root, ".data", "experiment-launcher");
const configPath = join(state, "connection.json");
const children = new Set();
let stopping = false;

function start(command, args, options = {}) {
  const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: "inherit", ...options });
  children.add(child);
  child.once("exit", () => children.delete(child));
  child.once("error", (error) => { child.launchError = error; children.delete(child); });
  child.completion = new Promise((accept, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 || stopping ? accept() : reject(new Error(`${command} exited ${code ?? signal}`)));
  });
  child.completion.catch(() => {}); // May exit during health polling; readiness reports it.
  return child;
}
function stop() {
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === "win32" && child.ownsProcessGroup) {
      // Stop descendants too (pnpm and the Python research bridge).
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore", timeout: 5000 });
      killer.on("error", () => child.kill());
      killer.on("exit", () => child.kill());
    } else if (child.ownsProcessGroup) {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already exited. */ }
    } else child.kill();
  }
}
process.once("SIGINT", () => { stop(); process.exitCode = 130; });
process.once("SIGTERM", () => { stop(); process.exitCode = 143; });

async function loadConfig() {
  try { return JSON.parse(await readFile(configPath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
function checkHost(host) {
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host)) {
    throw new Error("Use an SSH destination such as root@203.0.113.10 (no options or spaces).");
  }
}
async function freePort() {
  return new Promise((accept, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => accept(port));
    });
  });
}
async function ready(url, key, child) {
  for (let i = 0; i < 100 && !stopping; i++) {
    if (child.launchError) throw child.launchError;
    if (child.exitCode !== null || child.signalCode) {
      await child.completion;
      throw new Error("Experiment connection closed before it was ready.");
    }
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).service === "experiment-worker") {
        // Check authentication too; health alone is public.
        await experiment(url, key, { coefficients: [0], start: 0, end: 0, property: "zero" });
        return;
      }
    } catch { /* Wait for Python startup or SSH authentication/forwarding. */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("Experiment service did not become ready. Check SSH access; rerun experiments:setup if the remote key changed.");
}
async function experiment(url, key, request) {
  const response = await fetch(`${url}/experiments`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(request), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Experiment request failed (HTTP ${response.status}).`);
  const result = await response.json();
  if (result.outcome === "execution_error") throw new Error(result.diagnostic);
  return result;
}

async function setup(host) {
  const existing = await loadConfig();
  host ||= existing?.host;
  if (!host) {
    if (!process.stdin.isTTY) throw new Error("Supply your VM: pnpm experiments:setup root@YOUR_VM_IP");
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try { host = (await prompt.question("Vultr SSH destination (e.g. root@YOUR_VM_IP): ")).trim(); }
    finally { prompt.close(); }
  }
  checkHost(host);
  const key = existing?.host === host ? existing.key : randomBytes(32).toString("hex");
  const staging = await mkdtemp(join(state, "upload-"));
  const archive = `${staging}.tar`;
  try {
    for (const file of ["compute.py", "server.py", "lean_job.py", "Dockerfile", "compose.yml", "Caddyfile", ".dockerignore", "setup.sh"]) {
      const source = await readFile(join(root, "apps/experiment-worker", file), "utf8");
      await writeFile(join(staging, file), source.replace(/\r\n/g, "\n"));
    }
    // Ship the canonical fixed-theorem checker with the worker.
    await writeFile(join(staging, "lean_check.py"), (await readFile(join(root,
      "swarm-skills/math-research/scripts/lean_check.py"), "utf8")).replace(/\r\n/g, "\n"));
    await writeFile(join(staging, ".env"), `EXPERIMENT_API_KEY=${key}\n`, { mode: 0o600 });
    await start("tar", ["-cf", archive, "-C", staging, "."]).completion;
    console.log(`Deploying experiment service to ${host}. SSH may ask for your key/password or host confirmation.`);
    await start("ssh", [host, "umask 077; mkdir -p ~/triviality-experiments"]).completion;
    await start("scp", [archive, `${host}:triviality-experiments/upload.tar`]).completion;
    await start("ssh", [host, "set -e; umask 077; cd ~/triviality-experiments; tar -xf upload.tar; rm upload.tar; sh setup.sh"]).completion;
    await writeFile(configPath, JSON.stringify({ host, key }, null, 2) + "\n", { mode: 0o600 });
    console.log("Setup saved privately. Check Lean: pnpm lean:demo\nFor live research: pnpm experiments:worker");
  } finally {
    if (!resolve(staging).startsWith(resolve(state) + sep)) throw new Error("Refusing to clean a staging path outside launcher storage.");
    await rm(staging, { recursive: true, force: true });
    await rm(archive, { force: true });
  }
}

async function connect(local) {
  const config = local ? null : await loadConfig();
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const key = config?.key || randomBytes(32).toString("hex");
  let child;
  if (config) {
    checkHost(config.host);
    console.log(`Connecting to Vultr worker (${config.host})...`);
    child = start("ssh", ["-N", "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=15",
      "-o", "ServerAliveCountMax=2", "-L", `${port}:127.0.0.1:8090`, config.host]);
  } else {
    console.log("Local experiment worker — computations run on this machine, not Vultr.");
    const venv = join(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
    const python = process.env.SWARM_PYTHON || (existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3");
    child = start(python, ["apps/experiment-worker/server.py"], { env: { ...process.env,
      EXPERIMENT_API_KEY: key, EXPERIMENT_PORT: String(port), EXPERIMENT_HOST: "127.0.0.1",
      EXPERIMENT_DATA_DIR: join(state, "local-results") } });
  }
  await ready(url, key, child);
  return { url, key, child };
}

async function main() {
  const [command, argument, ...options] = process.argv.slice(2);
  if (options.length) throw new Error("Unexpected arguments; public domain setup is not supported.");
  if (!["setup", "demo", "lean-demo", "worker"].includes(command) || (argument && command !== "setup" && argument !== "--local")) {
    throw new Error("Usage: experiments:setup [user@host] | experiments:demo [--local] | lean:demo [--local] | experiments:worker [--local]");
  }
  await mkdir(state, { recursive: true, mode: 0o700 });
  if (command === "setup") return setup(argument);
  const { url, key, child: connection } = await connect(argument === "--local");
  if (command === "lean-demo") {
    await leanDemo(url, key);
  } else if (command === "demo") {
    console.log("\nDeterministic execution demo (no model API calls or Lean required).");
    console.log("Claim: n² + n + 41 is prime for every natural number.");
    for (const end of [39, 100]) {
      const result = await experiment(url, key, { coefficients: [41, 1, 1], start: 0, end, property: "prime" });
      console.log(`\nSearch 0..${end}: ${result.outcome}`);
      if (result.witness) console.log(`n=${result.witness.n}: ${result.witness.value} = ${result.witness.factor} × ${result.witness.value/result.witness.factor}`);
      else console.log("No counterexample in these bounds. This is not a proof.");
      console.log(`Job: ${result.job_id} (${result.duration_ms} ms recorded execution)`);
    }
    console.log("\nEvidence is ready for Challenger review. This demo uses a preset request, not a live Challenger.");
  } else {
    if (!process.env.npm_execpath) throw new Error("Start this command using pnpm experiments:worker.");
    await leanDemo(url, key);
    console.log("Experiment connection ready. Building the research worker...");
    await start(process.execPath, [process.env.npm_execpath, "--filter", "@triviality/research-worker...", "build"]).completion;
    if (stopping) return;
    console.log("Starting research worker; Ctrl+C stops the worker and experiment connection.");
    const worker = start(process.execPath, ["--env-file-if-exists=.env", "apps/research-worker/dist/worker.js"],
      { detached: process.platform !== "win32", env: { ...process.env, EXPERIMENT_API_URL: url, EXPERIMENT_API_KEY: key,
        LEAN_API_URL: url, LEAN_API_KEY: key } });
    worker.ownsProcessGroup = true;
    await Promise.race([worker.completion, connection.completion.then(() => { throw new Error("Experiment connection closed."); })]);
  }
}

async function leanDemo(url, key) {
  console.log("Checking Lean on the connected worker (no model API calls)...");
  for (const candidate of [
    { statement: "(n : Nat) : n = n", proof: "by rfl", expected: true },
    { statement: ": False", proof: "by decide", expected: false },
  ]) {
    const response = await fetch(`${url}/lean/check`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ statement: candidate.statement, proof: candidate.proof }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`Lean endpoint returned HTTP ${response.status}. Rerun experiments:setup to upgrade your VM.`);
    const result = await response.json();
    if (result.verified !== candidate.expected || result.statement !== candidate.statement
        || result.toolchain !== "leanprover/lean4:v4.19.0"
        || (!candidate.expected && result.checker !== "Lean rejected the candidate")) {
      throw new Error(`Lean check failed: ${result.checker || "Invalid response"}. Rerun experiments:setup to install the pinned compiler.`);
    }
    console.log(`${candidate.statement}: ${result.verified ? "verified" : "rejected"} (${result.duration_ms} ms)`);
  }
  console.log("Lean check passed. Proofs will be compiled on this worker.");
}

try { await main(); }
catch (error) { if (!stopping) { console.error(`\n${error.message}`); process.exitCode = 1; } }
finally { stop(); }
