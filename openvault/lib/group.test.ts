import { test, expect } from "vitest";
import { RUN_INTEGRATION, realClients } from "./itest";
import { createGroup, addToGroup, distribute } from "./group";

const itInt = test.skipIf(!RUN_INTEGRATION);
const ip = (s: string) => s as `0x${string}`;

itInt("createGroup returns a groupIpId", async () => {
  const { story } = await realClients();
  const { groupIpId } = await createGroup(story as any, {
    ipIds: [ip("0xa"), ip("0xb")],
    termsId: "1500",
  });
  expect(groupIpId).toBeTruthy();
});

itInt("addToGroup and distribute return tx hashes", async () => {
  const { story } = await realClients();
  const { groupIpId } = await createGroup(story as any, {
    ipIds: [ip("0xa")],
    termsId: "1500",
  });
  const add = await addToGroup(story as any, { groupIpId, ipIds: [ip("0xc")] });
  expect(add.txHash).toBeTruthy();
  const dist = await distribute(story as any, { groupIpId, memberIpIds: [ip("0xa"), ip("0xc")] });
  expect(dist.txHash).toBeTruthy();
});
