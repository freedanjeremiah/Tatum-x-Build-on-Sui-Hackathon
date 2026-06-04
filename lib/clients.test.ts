import { test, expect } from "vitest";
import { RUN_INTEGRATION, realClients } from "./itest";

const itInt = test.skipIf(!RUN_INTEGRATION);

itInt("real Seal-gated round-trip: upload then download returns same bytes", async () => {
  const clients = await realClients();
  // Sui core client bundle shape.
  expect(clients).toMatchObject({
    client: expect.anything(),
    signer: expect.anything(),
    address: expect.any(String),
    account: { address: expect.any(String) },
  });

  const owner = clients.account.address as `0x${string}`;

  const { uploadPrivate, download } = await import("./artifacts");
  const bytes = new TextEncoder().encode("secret weights");
  // Private (owner-only) tier: the registrant is unambiguously authorized, so the
  // seal_approve owner branch admits decryption — a deterministic round-trip that
  // does not depend on a separate license-grant step.
  const art = await uploadPrivate(clients, {
    bytes,
    meta: {
      title: "Integration private round-trip",
      description: "Live Sui register + Seal encrypt + Walrus publish round-trip check.",
      tags: ["integration", "private"],
      creators: [{ name: "Integration", address: owner, contributionPercent: 100 }],
      modality: "model",
    },
  });

  // Seal owner-gated download. `cid` carries the Walrus blobId; `ipId` is the
  // ArtifactRegistry object id.
  const out = await download(clients, {
    ipId: art.ipId,
    cid: art.cid,
    tier: "private",
  });
  expect(new TextDecoder().decode(out)).toBe("secret weights");
});
