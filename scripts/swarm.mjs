import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = process.env.SWARM_PYTHON || resolve(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
if (process.argv[2] === "test") {
  const localLean = resolve(root, ".data/lean/lean-4.19.0-windows/bin/lean.exe");
  const env = { ...process.env };
  if (!env.SWARM_LEAN_BIN && existsSync(localLean)) env.SWARM_LEAN_BIN = localLean;
  const child = spawn(python, ["-m", "unittest", "discover", "-s", "apps/research-swarm/tests", "-v"], { cwd: root, env, stdio: "inherit", windowsHide: true });
  child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
} else {
  const { runSwarm } = await import("../apps/research-worker/dist/swarm.js");
  const input = JSON.parse(await readFile(resolve(root, process.argv[2] || "apps/research-swarm/demo.json"), "utf8"));
  input.episode_id = process.env.SWARM_EPISODE_ID || `${input.episode_id}-${Date.now()}`;
  const catalog = JSON.parse(await readFile(resolve(root, "config/research-models.json"), "utf8"));
  input.role_models ??= Object.fromEntries(catalog.roles.map((role) => [role.id, catalog.defaultModel]));
  const result = await runSwarm(input, async (event) => {
    if (event.kind === "progress") {
      const p = event.event;
      if (["phase", "agent_started", "agent_completed", "agent_failed"].includes(p.kind)) console.log(`${p.kind}: ${p.label || p.phase || ""}`);
    }
  });
  console.log(JSON.stringify(result, null, 2));
  console.log(`Artifacts: ${resolve(root, ".data/swarm-runs", input.episode_id)}`);
}
