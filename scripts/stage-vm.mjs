import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { parse } = require('dotenv');
const root = new URL('../', import.meta.url);
const stage = new URL('../.data/vm-deploy/', import.meta.url);
await mkdir(stage, { recursive: true });
for (const path of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'packages/database', 'apps/research-api', 'apps/research-worker', 'apps/research-swarm', 'swarm-skills', 'config', 'deploy/vm']) {
  await cp(new URL(path, root), new URL(path, stage), { recursive: true, filter: p => !/[\\/](node_modules|dist|__pycache__|\.env)([\\/]|$)/.test(p) });
}
const env = parse(await readFile(new URL('.env', root)));
const connection = JSON.parse(await readFile(new URL('.data/experiment-launcher/connection.json', root)));
let key;
try { key = (await readFile(new URL('api-key', stage), 'utf8')).trim(); } catch { key = randomBytes(32).toString('hex'); }
await writeFile(new URL('api-key', stage), key, { mode: 0o600 });
const common = { MONGODB_URI: 'mongodb://127.0.0.1:27017', MONGODB_DATABASE: 'triviality', REDIS_URL: 'redis://127.0.0.1:6379' };
const providers = Object.fromEntries(Object.entries(env).filter(([k]) => /^(OPENAI_|GEMINI_|DEEPSEEK_|QWEN_|DEVIN_|EMBEDDING_|OPENALEX_)/.test(k)));
const worker = { ...providers, ...common, TRIVIALITY_URL: 'https://triviality-psi.vercel.app', EXPERIMENT_API_URL: 'http://127.0.0.1:8090', EXPERIMENT_API_KEY: connection.key, LEAN_API_URL: 'http://127.0.0.1:8090', LEAN_API_KEY: connection.key };
for (const [name, values] of Object.entries({ api: common, worker, gateway: { RESEARCH_DOMAIN: '155-138-157-87.sslip.io', RESEARCH_API_KEY: key } })) {
  await writeFile(new URL(`deploy/vm/${name}.env`, stage), Object.entries(values).map(([k,v]) => `${k}=${v}`).join('\n')+'\n', { mode: 0o600 });
}
await cp(new URL('external/norththehackers/snapshots/mathlab-2026-09-19.db', root), new URL('snapshot.db', stage));
await writeFile(new URL('.dockerignore', stage), '**/*.env\napi-key\nsnapshot.db\n');
console.log('Staged backend source, private runtime configuration, and the bundled atlas snapshot.');
