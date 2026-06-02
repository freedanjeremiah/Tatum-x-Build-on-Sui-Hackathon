import { test, expect, vi } from "vitest";
import { zeroAddress } from "viem";
import { RUN_INTEGRATION, realClients } from "./itest";
import {
  payRoyalty,
  claimRevenue,
  getClaimable,
  NoRoyaltyVaultError,
} from "./royalty";

const itInt = test.skipIf(!RUN_INTEGRATION);

const IP = "0xf79a6ac7b6d6461f50c3844d82059e8654c89aaa" as `0x${string}`;

test("payRoyalty refuses (no on-chain send) when the receiver has no royalty vault", async () => {
  // ipRoyaltyVaults(receiver) == zeroAddress → RoyaltyModule__ZeroReceiverVault
  // would revert the multicall after the user already paid gas. Catch it first.
  const publicClient = { readContract: vi.fn().mockResolvedValue(zeroAddress) };
  const story = { royalty: { payRoyaltyOnBehalf: vi.fn() } };

  await expect(
    payRoyalty(story as any, {
      childIpId: IP,
      amount: 1n,
      publicClient: publicClient as any,
    }),
  ).rejects.toBeInstanceOf(NoRoyaltyVaultError);

  expect(story.royalty.payRoyaltyOnBehalf).not.toHaveBeenCalled();
});

test("payRoyalty proceeds to pay when the receiver has a royalty vault", async () => {
  const publicClient = {
    readContract: vi
      .fn()
      .mockResolvedValue("0x00000000000000000000000000000000000000Va"),
  };
  const story = {
    royalty: {
      payRoyaltyOnBehalf: vi.fn().mockResolvedValue({ txHash: "0xabc" }),
    },
  };

  const out = await payRoyalty(story as any, {
    childIpId: IP,
    amount: 1n,
    publicClient: publicClient as any,
  });

  expect(out.txHash).toBe("0xabc");
  expect(story.royalty.payRoyaltyOnBehalf).toHaveBeenCalledOnce();
});

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
