import { test, expect, vi } from "vitest";
import { createGroup, addToGroup, distribute } from "./group";

// A fake SuiClient whose create_group tx yields a Group + GroupCap, and whose
// add_member / getObject calls succeed. getObject revenue is controllable so
// distribute can exercise both the skip (empty) and claim (funded) branches.
function fakeClient(revenueByArtifact: Record<string, bigint> = {}) {
  let n = 0;
  const core = {
    getObject: vi.fn(async ({ objectId }: { objectId: string }) => ({
      object: {
        json: {
          owner: "0xowner",
          tier: 2,
          price: "0",
          group_id: null,
          parent: null,
          license_holders: { fields: { contents: [] } },
          compute_workers: { fields: { contents: [] } },
          revoked: { fields: { contents: [] } },
          revenue: (revenueByArtifact[objectId] ?? 0n).toString(),
          dispute_count: "0",
          disputed: false,
        },
      },
    })),
    signAndExecuteTransaction: vi.fn(async () => {
      const objectId = `0xgroup${n}`;
      const capId = `0xgcap${n}`;
      n++;
      return {
        $kind: "Transaction",
        Transaction: {
          digest: `0xdig${n}`,
          effects: {
            status: { success: true },
            changedObjects: [
              { objectId, idOperation: "Created" },
              { objectId: capId, idOperation: "Created" },
            ],
          },
          objectTypes: {
            [objectId]: "0xpkg::registry::Group",
            [capId]: "0xpkg::registry::GroupCap",
          },
        },
      };
    }),
    waitForTransaction: vi.fn(async () => ({})),
  };
  return { core } as any;
}

const signer = {} as any;

test("createGroup creates a Group + GroupCap and binds members", async () => {
  const client = fakeClient();
  const out = await createGroup({ client, signer }, ["0xa", "0xb"]);
  expect(out.groupId).toBeTruthy();
  expect(out.capId).toBeTruthy();
  expect(out.members).toHaveLength(2);
  expect(out.members[0].artifactId).toBe("0xa");
});

test("addToGroup throws on an empty member list (no silent no-op)", async () => {
  const client = fakeClient();
  await expect(addToGroup({ client, signer }, "0xcap", "0xgroup", [])).rejects.toThrow();
});

test("addToGroup records each member and returns the last tx", async () => {
  const client = fakeClient();
  const out = await addToGroup({ client, signer }, "0xcap", "0xgroup", ["0xc", "0xd"]);
  expect(out.members).toHaveLength(2);
  expect(out.txHash).toBeTruthy();
});

test("distribute skips empty-vault members and claims funded ones", async () => {
  const client = fakeClient({ "0xfull": 1000n }); // 0xempty has no revenue
  const out = await distribute({ client, signer }, [
    { artifactId: "0xempty", capId: "0xcap1" },
    { artifactId: "0xfull", capId: "0xcap2" },
  ]);
  expect(out.totalClaimed).toBe(1000n);
  const empty = out.results.find((r) => r.artifactId === "0xempty")!;
  const full = out.results.find((r) => r.artifactId === "0xfull")!;
  expect(empty.txHash).toBeNull();
  expect(empty.skipped).toBeTruthy();
  expect(full.claimed).toBe(1000n);
  expect(full.txHash).toBeTruthy();
});
