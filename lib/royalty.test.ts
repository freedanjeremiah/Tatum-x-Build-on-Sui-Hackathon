import { test, expect, vi } from "vitest";
import {
  payRoyalty,
  claimRevenue,
  getClaimable,
  NoRoyaltyVaultError,
} from "./royalty";

const ART = "0xart";
const PARENT = "0xparent";

// A fake SuiClient core whose getObject returns a controllable ArtifactRegistry
// JSON view, and whose signAndExecuteTransaction returns a successful tx.
function fakeClient(opts: { revenue?: bigint; parent?: string | null } = {}) {
  const json = {
    owner: "0xowner",
    tier: 2,
    price: "0",
    group_id: null,
    parent: opts.parent ?? null,
    license_holders: { fields: { contents: [] } },
    compute_workers: { fields: { contents: [] } },
    revoked: { fields: { contents: [] } },
    revenue: (opts.revenue ?? 0n).toString(),
    dispute_count: "0",
    disputed: false,
  };
  let n = 0;
  const core = {
    getObject: vi.fn(async () => ({ object: { json } })),
    signAndExecuteTransaction: vi.fn(async () => ({
      $kind: "Transaction",
      Transaction: {
        digest: `0xdig${n++}`,
        effects: { status: { success: true }, changedObjects: [] },
        objectTypes: {},
      },
    })),
    waitForTransaction: vi.fn(async () => ({})),
  };
  return { core } as any;
}

const signer = {} as any;

test("getClaimable reads the on-chain revenue balance as a bigint", async () => {
  const client = fakeClient({ revenue: 500n });
  const c = await getClaimable({ client }, ART);
  expect(typeof c).toBe("bigint");
  expect(c).toBe(500n);
});

test("payRoyalty rejects a non-positive amount before signing", async () => {
  const client = fakeClient();
  await expect(payRoyalty({ client, signer }, ART, 0n)).rejects.toThrow();
  expect(client.core.signAndExecuteTransaction).not.toHaveBeenCalled();
});

test("payRoyalty pays the full amount to the artifact when no split requested", async () => {
  const client = fakeClient({ parent: PARENT });
  const out = await payRoyalty({ client, signer }, ART, 100n);
  expect(out.amountToArtifact).toBe(100n);
  expect(out.amountToParent).toBe(0n);
  expect(out.txHash).toBeTruthy();
  expect(client.core.signAndExecuteTransaction).toHaveBeenCalledOnce();
});

test("payRoyalty splits a share up to the parent vault", async () => {
  const client = fakeClient({ parent: PARENT });
  const out = await payRoyalty({ client, signer }, ART, 100n, { parentSharePct: 30 });
  expect(out.amountToParent).toBe(30n);
  expect(out.amountToArtifact).toBe(70n);
  expect(out.parentTxHash).toBeTruthy();
  // two pay_royalty txs: parent + artifact
  expect(client.core.signAndExecuteTransaction).toHaveBeenCalledTimes(2);
});

test("claimRevenue throws NoRoyaltyVaultError when the vault is empty", async () => {
  const client = fakeClient({ revenue: 0n });
  await expect(claimRevenue({ client, signer }, ART, "0xcap")).rejects.toBeInstanceOf(
    NoRoyaltyVaultError,
  );
  expect(client.core.signAndExecuteTransaction).not.toHaveBeenCalled();
});

test("claimRevenue withdraws when the vault has a balance", async () => {
  const client = fakeClient({ revenue: 777n });
  const out = await claimRevenue({ client, signer }, ART, "0xcap");
  expect(out.claimed).toBe(777n);
  expect(out.txHash).toBeTruthy();
  expect(client.core.signAndExecuteTransaction).toHaveBeenCalledOnce();
});
