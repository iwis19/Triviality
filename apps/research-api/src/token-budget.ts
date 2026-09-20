export function tokenBudgetForRequest(value: unknown, fallback = process.env.SWARM_TOKEN_BUDGET): number {
  const budget = value === undefined ? Number(fallback || 60000) : value;
  if (typeof budget !== "number" || !Number.isInteger(budget) || budget < 10000 || budget > 1000000) {
    throw new Error("tokenBudget must be an integer from 10000 to 1000000");
  }
  return budget;
}
