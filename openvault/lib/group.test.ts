import { test, expect } from "vitest";
import { makeMockClients } from "./mock/story";
import { createGroup, addToGroup, distribute } from "./group";

const ip = (s: string) => s as `0x${string}`;

test("createGroup returns a groupIpId in mock", async () => {
  const { story } = makeMockClients("0xowner");
  const { groupIpId } = await createGroup(story as any, {
    ipIds: [ip("0xa"), ip("0xb")],
    termsId: "1500",
  });
  expect(groupIpId).toBeTruthy();
});

test("addToGroup and distribute return tx hashes in mock", async () => {
  const { story } = makeMockClients("0xowner");
  const { groupIpId } = await createGroup(story as any, {
    ipIds: [ip("0xa")],
    termsId: "1500",
  });
  const add = await addToGroup(story as any, { groupIpId, ipIds: [ip("0xc")] });
  expect(add.txHash).toBeTruthy();
  const dist = await distribute(story as any, { groupIpId, memberIpIds: [ip("0xa"), ip("0xc")] });
  expect(dist.txHash).toBeTruthy();
});
