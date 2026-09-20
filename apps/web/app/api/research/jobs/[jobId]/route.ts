import { NextResponse } from "next/server";

const researchApiUrl = process.env.RESEARCH_API_URL ?? "http://localhost:3010";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const response = await fetch(`${researchApiUrl}/research/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    return new NextResponse(await response.text(), { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Research API unavailable" }, { status: 503 });
  }
}
