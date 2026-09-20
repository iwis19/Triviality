import assert from "node:assert/strict";
import test from "node:test";
import { getResearchStatus } from "./research-status.ts";

test("finished runs require a verified proof for the completed state", () => {
  assert.equal(getResearchStatus({ status: "completed" }), "completed_unverified");
  assert.equal(getResearchStatus({ status: "completed", proof: { status: "candidate" } }), "completed_unverified");
  assert.equal(getResearchStatus({ status: "completed", proof: { status: "verified" } }), "completed");
});

test("running and failed states take precedence over proof artifacts", () => {
  for (const status of ["running", "failed"]) {
    assert.equal(getResearchStatus({ status, proof: { status: "verified" } }), status);
  }
});
