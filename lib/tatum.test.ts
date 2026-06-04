import { test, expect, vi, beforeEach, afterEach } from "vitest";

// These tests exercise lib/tatum.ts with a mocked global fetch. They run in the
// always-on (non-integration) set — no network, no real Tatum key. We set
// TATUM_API_KEY in-process so the key-gated functions are reachable; the
// no-key honest-throw is covered by re-importing with the key cleared.

const ORIGINAL_KEY = process.env.TATUM_API_KEY;

beforeEach(() => {
  vi.resetModules();
  process.env.TATUM_API_KEY = "test-key-do-not-log";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.TATUM_API_KEY;
  else process.env.TATUM_API_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
});

/** Build a Response-like stub for the mocked fetch. */
function res(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => text,
  } as unknown as Response;
}

test("tatumGasPrice parses the JSON-RPC u64 string result into a bigint", async () => {
  const fetchMock = vi.fn(async () =>
    res({ jsonrpc: "2.0", id: 1, result: "1234" }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const { tatumGasPrice } = await import("./tatum");
  const price = await tatumGasPrice();

  expect(price).toBe(1234n);
  expect(typeof price).toBe("bigint");

  // It POSTs suix_getReferenceGasPrice to the gateway with the x-api-key header.
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(init.method).toBe("POST");
  const headers = init.headers as Record<string, string>;
  expect(headers["x-api-key"]).toBe("test-key-do-not-log");
  expect(JSON.parse(init.body as string).method).toBe("suix_getReferenceGasPrice");
});

test("tatumNetworkStatus combines gas + checkpoint + system state", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const method = JSON.parse((init?.body as string) ?? "{}").method as string;
    if (method === "suix_getReferenceGasPrice") return res({ result: "1000" });
    if (method === "sui_getLatestCheckpointSequenceNumber") return res({ result: "42" });
    if (method === "suix_getLatestSuiSystemState")
      return res({ result: { epoch: "7", totalStake: "999" } });
    throw new Error(`unexpected method ${method}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const { tatumNetworkStatus } = await import("./tatum");
  const status = await tatumNetworkStatus();

  expect(status.referenceGasPrice).toBe("1000");
  expect(status.checkpoint).toBe("42");
  expect(status.epoch).toBe("7");
  expect(status.totalStake).toBe("999");
  expect(typeof status.network).toBe("string");
});

test("createAddressSubscription POSTs the v4 ADDRESS_EVENT shape and returns the id", async () => {
  const fetchMock = vi.fn(async () => res({ id: "sub-abc-123" }));
  vi.stubGlobal("fetch", fetchMock);

  const { createAddressSubscription } = await import("./tatum");
  const id = await createAddressSubscription("0xpublisher", "https://reef.example/api/tatum/webhook");

  expect(id).toBe("sub-abc-123");

  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("/v4/subscription");
  expect(init.method).toBe("POST");
  const headers = init.headers as Record<string, string>;
  expect(headers["x-api-key"]).toBe("test-key-do-not-log");
  expect(headers["content-type"]).toBe("application/json");
  const sent = JSON.parse(init.body as string) as {
    type: string;
    attr: { address: string; url: string; chain: string };
  };
  expect(sent.type).toBe("ADDRESS_EVENT");
  expect(sent.attr.address).toBe("0xpublisher");
  expect(sent.attr.url).toBe("https://reef.example/api/tatum/webhook");
  expect(sent.attr.chain).toMatch(/^sui-/);
});

test("listSubscriptions GETs /v4/subscription and returns the array", async () => {
  const subs = [
    { id: "s1", type: "ADDRESS_EVENT", attr: { address: "0xaaa", url: "u1", chain: "sui-testnet" } },
  ];
  const fetchMock = vi.fn(async () => res(subs));
  vi.stubGlobal("fetch", fetchMock);

  const { listSubscriptions } = await import("./tatum");
  const got = await listSubscriptions();

  expect(got).toEqual(subs);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("/v4/subscription");
  expect((init.method ?? "GET")).toBe("GET");
});

test("deleteSubscription issues a DELETE to the subscription id", async () => {
  const fetchMock = vi.fn(async () => res({}, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const { deleteSubscription } = await import("./tatum");
  await deleteSubscription("sub-xyz");

  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("/v4/subscription/sub-xyz");
  expect(init.method).toBe("DELETE");
});

test("ensureAddressSubscription reuses an existing matching subscription (no create)", async () => {
  const existing = [
    {
      id: "existing-1",
      type: "ADDRESS_EVENT",
      attr: { address: "0xPub", url: "https://reef.example/hook", chain: "sui-testnet" },
    },
  ];
  const fetchMock = vi.fn(async () => res(existing));
  vi.stubGlobal("fetch", fetchMock);

  const { ensureAddressSubscription } = await import("./tatum");
  const out = await ensureAddressSubscription("0xpub", "https://reef.example/hook");

  expect(out).toEqual({ id: "existing-1", created: false });
  // Only the list call — no POST create.
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("no API key → honest throw (no silent fallback, never logs the key)", async () => {
  delete process.env.TATUM_API_KEY;
  vi.resetModules();
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const { tatumGasPrice, createAddressSubscription, hasTatumKey } = await import("./tatum");

  expect(hasTatumKey()).toBe(false);
  await expect(tatumGasPrice()).rejects.toThrow(/TATUM_API_KEY is not set/);
  await expect(
    createAddressSubscription("0xa", "https://x/hook"),
  ).rejects.toThrow(/TATUM_API_KEY is not set/);
  // Never attempted a network call without a key.
  expect(fetchMock).not.toHaveBeenCalled();
});
