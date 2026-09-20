import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createEnvironmentLoader } from "../dist/environment.js";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "worker-env-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("a running worker picks up a key added or rotated after startup", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, ".env"), "OPENAI_API_KEY=\n");
  const load = createEnvironmentLoader(root, { PATH: "/bin" });
  assert.equal(load().OPENAI_API_KEY, "");
  writeFileSync(join(root, ".env"), "OPENAI_API_KEY=fixture-added\n");
  assert.equal(load().OPENAI_API_KEY, "fixture-added");
  writeFileSync(join(root, ".env"), "OPENAI_API_KEY=fixture-rotated\n");
  assert.equal(load().OPENAI_API_KEY, "fixture-rotated");
  writeFileSync(join(root, ".env"), "");
  assert.equal(load().OPENAI_API_KEY, undefined);
  assert.equal(load().PATH, "/bin");
});

test("local and worker files override defaults while shell settings retain precedence", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, ".env"), "OPENAI_API_KEY=\n");
  writeFileSync(join(root, ".env.local"), "OPENAI_API_KEY=root-local\n");
  const load = createEnvironmentLoader(root, {});
  assert.equal(load().OPENAI_API_KEY, "root-local");
  mkdirSync(join(root, "apps/research-worker"), { recursive: true });
  writeFileSync(join(root, "apps/research-worker/.env"), "OPENAI_API_KEY=worker\n");
  assert.equal(load().OPENAI_API_KEY, "worker");
  assert.equal(createEnvironmentLoader(root, { OPENAI_API_KEY: "shell" })().OPENAI_API_KEY, "shell");
});
