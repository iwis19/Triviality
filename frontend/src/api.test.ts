import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivateApi, publicApi } from "./api";

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () => ({
    ok,
    status,
    statusText: ok ? "OK" : "Unauthorized",
    text: async () => JSON.stringify(body),
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("publicApi", () => {
  it("never sends credentials and encodes graph layer filters", async () => {
    const fetchMock = mockFetch({ nodes: [], links: [], layers: [] });
    await publicApi.graph(["atlas", "lineage"], "lonely-runner");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/public/graph?layers=atlas%2Clineage&problem=lonely-runner");
    expect(init.headers).toEqual({});
  });

  it("escapes area and slug parameters", async () => {
    const fetchMock = mockFetch([]);
    await publicApi.problems("number theory");
    await publicApi.problem("a/b");
    const urls = fetchMock.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls).toEqual(["/public/problems?area=number%20theory", "/public/problems/a%2Fb"]);
  });
});

describe("PrivateApi", () => {
  it("sends the key only as X-API-Key and posts JSON bodies", async () => {
    const fetchMock = mockFetch({ id: "p", status: "disputed", assertions_reviewed: 2 });
    const api = new PrivateApi("secret-key");
    await api.reviewProblem("p", "disputed", "checked both sources");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/private/problems/p/review");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "X-API-Key": "secret-key" });
    expect(JSON.parse(String(init.body))).toEqual({ status: "disputed", note: "checked both sources" });
    expect(url).not.toContain("secret-key");
  });

  it("surfaces HTTP errors instead of swallowing them", async () => {
    mockFetch({ detail: "invalid api key" }, false, 401);
    const api = new PrivateApi("bad");
    await expect(api.status()).rejects.toThrow(/401/);
  });

  it("requests the Wikipedia import as a dry run when previewing", async () => {
    const fetchMock = mockFetch({ parsed: 3, dry_run: true });
    await new PrivateApi("k").importWikipedia(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ dry_run: true });
  });
});
