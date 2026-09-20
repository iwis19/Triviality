import { readFileSync } from "node:fs";

// Public identifiers only. Credentials are resolved in the worker, never in a job.
export const catalog = JSON.parse(readFileSync(new URL("../../../config/research-models.json", import.meta.url), "utf8")) as {
  roles: Array<{ id: string; label: string; description: string }>;
  defaultModel: string;
  models: Array<{ id: string; disabled?: boolean }>;
};

export function validateRoleModels(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a model for every research role");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !catalog.roles.some((role) => role.id === key))) throw new Error("Unknown research role");
  return Object.fromEntries(catalog.roles.map((role) => {
    const model = catalog.models.find((item) => item.id === input[role.id]);
    if (!model || model.disabled) throw new Error(`Choose a supported model for ${role.label}`);
    return [role.id, model.id];
  }));
}
