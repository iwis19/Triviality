import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export type SwarmProof = {
  verified: boolean; checker: string; axioms: string[]; log: string;
  lean: string; theoremName: string; statement: string; explanation?: string;
};
export type SwarmResult = {
  status: "verified" | "formalized" | "candidate" | "blocked";
  summary: string; reports: Array<{ approach: string; evidence: string; risks: string; next_step: string } | null>;
  proof?: SwarmProof | null; target_origin?: string;
};

export async function runSwarm(
  input: Record<string, unknown>,
  onEvent: (event: Record<string, unknown>) => Promise<void>,
): Promise<SwarmResult> {
  const python = process.env.SWARM_PYTHON || resolve(repositoryRoot,
    process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
  return new Promise((accept, reject) => {
    const child = spawn(python, [resolve(repositoryRoot, "apps/research-swarm/runner.py")], {
      cwd: repositoryRoot, env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    });
    let result: SwarmResult | undefined;
    let error = "";
    let persistenceError: unknown;
    let pending = Promise.resolve();
    const timeout = setTimeout(() => {
      error = "Research team exceeded SWARM_TIMEOUT_MS";
      child.kill();
    }, Number(process.env.SWARM_TIMEOUT_MS || 900000));
    child.on("error", (cause) => { clearTimeout(timeout); reject(cause); });
    child.stderr.on("data", (chunk: Buffer) => { error = (error + chunk.toString()).slice(-4000); });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        const message = JSON.parse(line) as Record<string, unknown>;
        if (message.kind === "result") result = message.result as SwarmResult;
        else if (message.kind === "error") error = String(message.message);
        else pending = pending.then(() => onEvent(message)).catch((cause) => {
          persistenceError = cause;
          child.kill();
        });
      } catch { error = "Invalid JSON-lines output from SwarmFlow"; child.kill(); }
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      void pending.then(() => {
        if (persistenceError) reject(persistenceError);
        else if (code !== 0 || !result) reject(new Error(error || `SwarmFlow exited ${code} without a result`));
        else accept(result);
      });
    });
    child.stdin.on("error", () => { /* The close/error handlers report an early subprocess exit. */ });
    child.stdin.end(JSON.stringify(input) + "\n");
  });
}
