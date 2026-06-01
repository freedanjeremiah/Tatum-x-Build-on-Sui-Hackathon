import { test, expect } from "vitest";

// Isolate the route's datastore BEFORE importing it — the route lazily opens
// `process.env.OPENVAULT_DB_PATH` on first request, so an in-memory DB here means
// these tests never pollute the real index (indexer/openvault.db).
process.env.OPENVAULT_DB_PATH = ":memory:";

const { POST, GET } = await import("./route");

// NOTE: the route's parseArtifact validates ipId/createdTx as strict 0x-hex
// (`/^0x[0-9a-fA-F]+$/`). The plan's sample fixtures ("0xapi…001", "0xtxApi")
// contain non-hex letters and would 400 on those fields before owner is ever
// reached. Adapted to valid hex so the test exercises the owner path it intends.
test("POST accepts a valid owner and GET filters by it", async () => {
  const body = {
    ipId: "0xa910000000000000000000000000000000000001",
    tier: "public", modality: "dataset", title: "API Owned",
    description: "d", tags: ["api"], ipMetadataURI: "ipfs://m",
    createdTx: "0xabcdef01",
    owner: "0xCcCc000000000000000000000000000000000003",
  };
  const post = await POST(new Request("http://x/api/index", {
    method: "POST", body: JSON.stringify(body),
  }));
  expect(post.status).toBe(200);

  const get = await GET(new Request("http://x/api/index?owner=0xcccc000000000000000000000000000000000003"));
  const list = (await get.json()) as Array<{ ipId: string; owner?: string }>;
  expect(list.some((a) => a.ipId === body.ipId)).toBe(true);
});

test("POST rejects a non-hex owner", async () => {
  const res = await POST(new Request("http://x/api/index", {
    method: "POST",
    body: JSON.stringify({
      ipId: "0xa920000000000000000000000000000000000002",
      tier: "public", modality: "dataset", title: "Bad", description: "d",
      tags: [], ipMetadataURI: "ipfs://m", createdTx: "0xabcdef02", owner: "not-hex",
    }),
  }));
  expect(res.status).toBe(400);
});
