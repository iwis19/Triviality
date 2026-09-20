// Real Node -> Python -> upstream SwarmFlow -> HTTP fixture -> Lean integration.
import { runSwarm } from "../../research-worker/dist/swarm.js";
const events = [];
const input = JSON.parse(process.argv[2]);
const result = await runSwarm(input, async (event) => { events.push(event); });
console.log(JSON.stringify({ result, events }));
