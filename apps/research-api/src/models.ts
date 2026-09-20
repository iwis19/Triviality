import { readFileSync } from "node:fs";

// Public identifiers only. Credentials are resolved in the worker, never in a job.
export const catalog = JSON.parse(readFileSync(new URL("../../../config/research-models.json", import.meta.url), "utf8")) as {
  roles: Array<{ id: string; label: string; description: string }>;
  defaultModel: string;
  models: Array<{ id: string; disabled?: boolean }>;
};

export function validateRoleModels(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a model for every research role");
  let input = value as Record<string, unknown>;
  const legacyRoles = ["coordinator", "researcher", "challenger", "critic", "proof_writer"];
  if (Object.keys(input).length === 5 && legacyRoles.every((role) => role in input)) {
    input = { coordinator: input.coordinator, researcher_1: input.researcher, researcher_2: input.challenger,
      researcher_3: input.researcher, challenger: input.critic, proof_writer: input.proof_writer };
  }
  if (Object.keys(input).some((key) => !catalog.roles.some((role) => role.id === key))) throw new Error("Unknown research role");
  return Object.fromEntries(catalog.roles.map((role) => {
    const model = catalog.models.find((item) => item.id === input[role.id]);
    if (!model || model.disabled) throw new Error(`Choose a supported model for ${role.label}`);
    return [role.id, model.id];
  }));
}
