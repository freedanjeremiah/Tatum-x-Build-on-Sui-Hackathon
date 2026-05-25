import { test, expect } from "vitest";
import { makeMockClients } from "./mock/story";
import { payRoyalty, claimRevenue, getClaimable } from "./royalty";

test("getClaimable returns a bigint > 0 in mock", async () => {
  const { story } = makeMockClients("0xowner");
  const c = await getClaimable(story as any, { ipId: "0xparent" as `0x${string}` });
  expect(typeof c).toBe("bigint");
  expect(c > 0n).toBe(true);
});

test("payRoyalty and claimRevenue return tx hashes in mock", async () => {
  const { story } = makeMockClients("0xowner");
  const pay = await payRoyalty(story as any, {
    childIpId: "0xchild" as `0x${string}`,
    amount: 2n,
  });
  expect(pay.txHash).toBeTruthy();
  const claim = await claimRevenue(story as any, {
    parentIpId: "0xparent" as `0x${string}`,
    childIpIds: ["0xchild" as `0x${string}`],
  });
  expect(claim.txHash).toBeTruthy();
});
