import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = resolve(root, ".env");
if (existsSync(envFile)) loadEnvFile(envFile);

const python = process.env.BACKEND_PYTHON || resolve(root,
  process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const commands = {
  dev: [["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"]],
  start: [["-m", "uvicorn", "app.main:app", "--port", "8000"]],
  test: [["-m", "pytest", "-q"]],
  check: [["-m", "ruff", "check", "app", "tests"],
    ["-m", "ruff", "format", "--check", "app", "tests"], ["-m", "mypy", "app"]],
};
const command = process.argv[2];
if (!Object.hasOwn(commands, command)) {
  console.error("Usage: node scripts/backend.mjs <dev|start|test|check> [arguments]");
  process.exitCode = 1;
} else {
  for (const args of commands[command]) {
    const code = await new Promise((accept) => {
      const child = spawn(python, [...args, ...process.argv.slice(3)], {
        cwd: resolve(root, "external/norththehackers/backend"),
        env: process.env,
        stdio: "inherit",
      });
      child.on("error", (error) => {
        console.error(`Could not run the backend: ${error.message}`);
        console.error("Follow the Python environment setup in docs/backend.md, or set BACKEND_PYTHON.");
        accept(1);
      });
      child.on("exit", (exitCode) => accept(exitCode ?? 1));
    });
    if (code !== 0) {
      process.exitCode = code;
      break;
    }
  }
}
