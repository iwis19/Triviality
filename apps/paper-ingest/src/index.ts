import { config } from "./config.js";
import { ingestTopMathPapers, startScheduler } from "./ingest.js";

const once = process.argv.includes("--once");

if (once || config.runOnStart) {
  await ingestTopMathPapers().then((result) => console.log("paper ingestion complete", result)).catch((error) => {
    console.error(error);
    if (once) process.exitCode = 1;
  });
}

if (!once) {
  console.log(`paper ingestion scheduler active; interval=${config.intervalMinutes}m`);
  startScheduler();
}
