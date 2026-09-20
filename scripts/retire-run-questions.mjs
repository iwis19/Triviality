import { getCollections, getMongoClient } from '../packages/database/dist/client.js';
import { retireRunQuestions } from '../packages/database/dist/retire-run-questions.js';

try {
  const retired = await retireRunQuestions(await getCollections());
  console.log(JSON.stringify({ retiredQuestions: retired.length, ids: retired }));
} finally {
  await (await getMongoClient()).close();
}
