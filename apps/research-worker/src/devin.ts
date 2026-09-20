import { randomUUID } from "node:crypto";
import { getCollections } from "@triviality/database";
import { config } from "./config.js";

type DevinSession = {
  session_id?: string;
  url?: string;
  status?: string;
  status_detail?: string;
};

type DevinMessage = {
  message?: string;
};

type DevinRole = {
  name: string;
  strategy: string;
  prompt: string;
};

const terminalStatuses = new Set(["exit", "error", "suspended"]);
const pollIntervalMs = 20_000;
const maxPolls = 90;

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function apiUrl(path: string): string {
  return `${config.devinBaseUrl.replace(/\/$/, "")}${path}`;
}

async function devinFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!config.devinApiKey) throw new Error("DEVIN_API_KEY is not configured");
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${config.devinApiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body === "object" && body && "detail" in body ? String(body.detail) : response.statusText;
    throw new Error(`Devin API ${response.status}: ${detail}`);
  }
  return body as T;
}

async function resolveOrganizationId(): Promise<string> {
  if (config.devinOrgId) return config.devinOrgId;
  const response = await devinFetch<{ items?: Array<{ org_id?: string }> }>("/v3/enterprise/organizations");
  const organizationId = response.items?.find((item) => item.org_id)?.org_id;
  if (!organizationId) throw new Error("Devin returned no accessible organizations; set DEVIN_ORG_ID explicitly");
  return organizationId;
}

async function createSession(organizationId: string, role: DevinRole): Promise<DevinSession> {
  return devinFetch<DevinSession>(`/v3/organizations/${encodeURIComponent(organizationId)}/sessions`, {
    method: "POST",
    body: JSON.stringify({
      title: `Triviality · ${role.name}`,
      prompt: role.prompt,
      max_acu_limit: config.devinMaxAcu,
      tags: ["triviality", "math-research", role.name.toLowerCase().replaceAll(" ", "-")],
      structured_output_required: false,
    }),
  });
}

async function getSession(organizationId: string, sessionId: string): Promise<DevinSession | undefined> {
  const query = new URLSearchParams({ session_ids: sessionId, first: "1" });
  const response = await devinFetch<{ items?: DevinSession[] }>(`/v3/organizations/${encodeURIComponent(organizationId)}/sessions?${query.toString()}`);
  return response.items?.[0];
}

async function getMessages(organizationId: string, sessionId: string): Promise<string> {
  const query = new URLSearchParams({ first: "100" });
  const response = await devinFetch<{ items?: DevinMessage[] }>(`/v3/organizations/${encodeURIComponent(organizationId)}/sessions/${encodeURIComponent(sessionId)}/messages?${query.toString()}`);
  return (response.items ?? []).map((item) => item.message?.trim()).filter(Boolean).join("\n\n").slice(-20_000);
}

function roles(title: string, statement: string, literature: string[], episodeId: string): DevinRole[] {
  const context = `Research space: ${title}\nExploration brief: ${statement}\nEpisode id: ${episodeId}\nLiterature retrieved by Triviality:\n${literature.join("\n") || "No literature was retrieved."}`;
  return [
    {
      name: "Literature scout",
      strategy: "prior-art and terminology scan",
      prompt: `${context}\n\nAct as the literature scout. Find terminology variants, closely related theorems, assumptions, and possible duplicate results. Use available research tools if available. Return a concise research memo with URLs or exact source identifiers, and clearly separate established facts from hypotheses. Do not claim the target is solved. Do not modify the repository.`,
    },
    {
      name: "Cross-domain researcher",
      strategy: "structural analogy transfer",
      prompt: `${context}\n\nAct as the cross-domain researcher. Explore distant mathematical areas for a real structural correspondence that could transfer an invariant, construction, or proof pattern. State what maps, what assumptions fail to map, and the smallest falsifiable experiment. Return 2 or 3 competing transfer ideas with counterexample risks. Do not modify the repository.`,
    },
    {
      name: "Formal proof critic",
      strategy: "counterexample and Lean formalization critique",
      prompt: `${context}\n\nAct as a skeptical formal proof critic. Attack the target and likely generalizations. Find missing assumptions, small counterexamples, and one minimal Lean-friendly supporting lemma that is honest about its scope. Return candidate Lean statements only when you can explain why they should compile; never use sorry or axioms. Do not modify the repository.`,
    },
  ];
}

async function recordAttempt(episodeId: string, attemptId: string, update: Record<string, unknown>): Promise<void> {
  const collections = await getCollections();
  await collections.researchAttempts.updateOne({ _id: attemptId, episodeId }, { $set: { ...update, updatedAt: new Date() } });
}

async function emit(episodeId: string, type: string, payload: Record<string, unknown>): Promise<void> {
  const collections = await getCollections();
  await collections.researchEvents.insertOne({ _id: id("event"), episodeId, type, payload, createdAt: new Date(), updatedAt: new Date() });
}

async function monitorSession(organizationId: string, episodeId: string, attemptId: string, sessionId: string): Promise<void> {
  for (let poll = 0; poll < maxPolls; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const session = await getSession(organizationId, sessionId);
    if (!session || !terminalStatuses.has(session.status ?? "")) continue;
    const report = await getMessages(organizationId, sessionId).catch((error) => `Unable to retrieve Devin report: ${error instanceof Error ? error.message : "unknown error"}`);
    const succeeded = session.status === "exit";
    await recordAttempt(episodeId, attemptId, {
      status: succeeded ? "SUCCEEDED" : "FAILED",
      proofState: report || session.status_detail || `Devin session ended with status ${session.status}`,
      completedAt: new Date(),
      error: succeeded ? undefined : session.status_detail ?? `Devin session ended with status ${session.status}`,
    });
    await emit(episodeId, "research.devin.completed", { attemptId, sessionId, status: session.status, succeeded });
    return;
  }

  await recordAttempt(episodeId, attemptId, { status: "FAILED", error: "Devin session monitoring timed out", proofState: "Devin session is still running after the local monitoring window.", completedAt: new Date() });
  await emit(episodeId, "research.devin.timeout", { attemptId, sessionId });
}

export async function spawnDevinResearchAgents(episodeId: string, title: string, statement: string, literature: string[]): Promise<void> {
  if (!config.devinApiKey) return;

  const collections = await getCollections();
  const organizationId = await resolveOrganizationId();
  const researchRoles = roles(title, statement, literature, episodeId);
  const now = new Date();

  await Promise.all(researchRoles.map(async (role) => {
    const attemptId = id("attempt");
    await collections.researchAttempts.insertOne({
      _id: attemptId,
      episodeId,
      hypothesisId: "",
      strategy: `Devin · ${role.strategy}`,
      status: "QUEUED",
      input: { provider: "devin", role: role.name, organizationId, prompt: role.prompt },
      proofState: "Waiting for Devin session.",
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    });

    try {
      const session = await createSession(organizationId, role);
      if (!session.session_id) throw new Error("Devin create-session response did not include session_id");
      await recordAttempt(episodeId, attemptId, { status: "RUNNING", proofState: `Devin session created: ${session.session_id}`, input: { provider: "devin", role: role.name, organizationId, sessionId: session.session_id, sessionUrl: session.url, prompt: role.prompt } });
      await emit(episodeId, "research.devin.started", { attemptId, sessionId: session.session_id, role: role.name, sessionUrl: session.url });
      void monitorSession(organizationId, episodeId, attemptId, session.session_id).catch(async (error) => {
        await recordAttempt(episodeId, attemptId, { status: "FAILED", error: error instanceof Error ? error.message : "Devin monitor failed", completedAt: new Date() });
      });
    } catch (error) {
      await recordAttempt(episodeId, attemptId, { status: "FAILED", error: error instanceof Error ? error.message : "Devin session creation failed", proofState: "Devin session could not be created.", completedAt: new Date() });
      await emit(episodeId, "research.devin.failed", { attemptId, role: role.name, error: error instanceof Error ? error.message : "Devin session creation failed" });
    }
  }));
}
