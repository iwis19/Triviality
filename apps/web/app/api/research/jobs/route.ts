import { NextResponse } from "next/server";

const researchApiUrl = process.env.RESEARCH_API_URL ?? "http://localhost:3010";

export async function GET() {
  return proxy("/research/jobs");
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxy("/research/jobs", { method: "POST", body, headers: { "content-type": "application/json" } });
}

async function proxy(path: string, init?: RequestInit) {
  try {
    const response = await fetch(`${researchApiUrl}${path}`, { ...init, cache: "no-store" });
    return new NextResponse(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Research API unavailable" }, { status: 503 });
  }
}
