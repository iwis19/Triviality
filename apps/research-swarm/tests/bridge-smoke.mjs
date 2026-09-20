// Real Node -> Python -> upstream SwarmFlow -> HTTP fixture -> Lean integration.
import { runSwarm } from "../../research-worker/dist/swarm.js";
const events = [];
const input = JSON.parse(process.argv[2]);
const searches = [];
const result = await runSwarm(input, async (event) => { events.push(event); }, async (request) => {
  searches.push(request);
  return { papers: [{ id: "fixture-paper", title: "Order and induction", abstract: "Natural number order is preserved by addition." }] };
});
console.log(JSON.stringify({ result, events, searches }));
