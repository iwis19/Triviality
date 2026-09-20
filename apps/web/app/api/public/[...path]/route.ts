import { NextResponse } from "next/server";

const researchApiUrl = process.env.RESEARCH_API_URL ?? "http://localhost:3010";

// Proxies the anonymous public read API (published atlas projections only).
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const target = `${researchApiUrl}/public/${path.join("/")}${new URL(request.url).search}`;
  try {
    const response = await fetch(target, { cache: "no-store" });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Research API unavailable" },
      { status: 503 },
    );
  }
}
