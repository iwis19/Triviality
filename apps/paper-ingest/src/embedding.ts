import { config } from "./config.js";
import type { EmbeddingProvider } from "./types.js";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly model = config.embeddingModel;

  async embed(input: string): Promise<number[] | null> {
    if (!config.embeddingApiKey) {
      console.warn("EMBEDDING_API_KEY is not set; paper metadata will be stored without a vector.");
      return null;
    }

    const response = await fetch(config.embeddingApiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.embeddingApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, input }),
    });
    if (!response.ok) throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = payload.data?.[0]?.embedding;
    if (!vector?.length) throw new Error("Embedding response did not contain a vector");
    return vector;
  }
}
