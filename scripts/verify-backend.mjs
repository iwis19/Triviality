// Run inside the deployed API container; uses its environment, never prints keys.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getMongoClient, getDatabase } from '../packages/database/dist/client.js';
import { ensureIndexes } from '../packages/database/dist/ensure-indexes.js';

const expectedUri = process.env.MONGODB_URI;
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1';
await assert.rejects(getMongoClient());
process.env.MONGODB_URI = expectedUri;
const db = await getDatabase();
assert.equal((await db.command({ ping: 1 })).ok, 1);
await ensureIndexes();
const id = randomUUID();
const collection = db.collection('_deployment_checks');
try {
  await collection.insertOne({ _id: id, checkedAt: new Date() });
  assert.ok(await collection.findOne({ _id: id }));
} finally {
  await collection.deleteOne({ _id: id });
}
const health = await fetch('http://127.0.0.1:3010/health').then(r => r.json());
assert.equal(health.mongo, 'ok');
assert.equal(health.redis, 'ok');
console.log(JSON.stringify({ health, mongoReadWrite: 'passed', failedConnectionRecovery: 'passed', areas: await db.collection('atlas_areas').countDocuments(), problems: await db.collection('atlas_problems').countDocuments(), publications: await db.collection('publications').countDocuments() }));
await (await getMongoClient()).close();
