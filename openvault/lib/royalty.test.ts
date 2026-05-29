import { test, expect } from "vitest";
import { RUN_INTEGRATION, realClients } from "./itest";
import { payRoyalty, claimRevenue, getClaimable } from "./royalty";

const itInt = test.skipIf(!RUN_INTEGRATION);

itInt("getClaimable returns a bigint", async () => {
  const { story } = await realClients();
  const c = await getClaimable(story as any, { ipId: "0xparent" as `0x${string}` });
  expect(typeof c).toBe("bigint");
});

itInt("payRoyalty and claimRevenue return tx hashes", async () => {
  const { story } = await realClients();
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
