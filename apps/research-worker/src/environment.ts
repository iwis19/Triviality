import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

export const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

// Capture shell overrides before dotenv or database imports populate process.env.
const inheritedEnvironment = { ...process.env };

export function createEnvironmentLoader(root: string, inherited: NodeJS.ProcessEnv) {
  const overrides = { ...inherited };
  return (): NodeJS.ProcessEnv => {
    const environment: NodeJS.ProcessEnv = {};
    // Local files override shared defaults; explicit shell settings win over both.
    for (const path of [".env", ".env.local", "apps/research-worker/.env", "apps/research-worker/.env.local"]) {
      try {
        Object.assign(environment, parse(readFileSync(resolve(root, path))));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return { ...environment, ...overrides };
  };
}

// Read again per job so editing a key does not require restarting the worker.
export const loadWorkerEnvironment = createEnvironmentLoader(repositoryRoot, inheritedEnvironment);
Object.assign(process.env, loadWorkerEnvironment());
