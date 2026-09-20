import assert from 'node:assert/strict';
const headers = { Authorization: `Bearer ${process.env.EXPERIMENT_API_KEY}`, 'Content-Type': 'application/json' };
const experiment = await fetch(`${process.env.EXPERIMENT_API_URL}/experiments`, { method: 'POST', headers, body: JSON.stringify({ coefficients: [41,1,1], start: 0, end: 100, property: 'prime' }) });
assert.equal(experiment.status, 200);
const evidence = await experiment.json();
assert.equal(evidence.outcome, 'counterexample_found');
for (const [statement, proof, expected] of [['(n : Nat) : n = n', 'by rfl', true], [': False', 'by decide', false]]) {
  const response = await fetch(`${process.env.LEAN_API_URL}/lean/check`, { method: 'POST', headers: { ...headers, Authorization: `Bearer ${process.env.LEAN_API_KEY}` }, body: JSON.stringify({ statement, proof }), signal: AbortSignal.timeout(45000) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verified, expected);
}
console.log('Worker connections passed: real experiment counterexample, valid Lean proof accepted, invalid Lean proof rejected.');
