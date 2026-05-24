// Deterministic in-memory mock of the Story Protocol core SDK client, plus the
// makeMockClients() factory that pairs it with a MockCdr. Each instance keeps
// its own counters so nothing leaks across instances.

import { MockCdr, makeMockCdr } from "./cdr";

const tx = (label: string, n: number) => ("0x" + label + n) as `0x${string}`;

// A valid 20-byte hex address derived from a numeric tag, so viem ABI-encoding
// (encodeAbiParameters with type "address") accepts mock ipIds/groupIds.
const addr = (n: number) =>
  ("0x" + n.toString(16).padStart(40, "0")) as `0x${string}`;

export class MockStory {
  private ipCounter = 0;
  private childCounter = 0;
  private licenseCounter = 0;
  private groupCounter = 0;
  private disputeCounter = 0;

  ipAsset = {
    registerIpAsset: async (..._args: unknown[]) => {
      const n = ++this.ipCounter;
      return {
        ipId: addr(0x1a0000 + n),
        licenseTermsId: "100" + n,
        tokenId: BigInt(n),
        txHash: tx("mockregip", n),
      };
    },
    registerDerivativeIpAsset: async (..._args: unknown[]) => {
      const n = ++this.childCounter;
      return {
        ipId: addr(0x2c0000 + n),
        tokenId: BigInt(1000 + n),
        txHash: tx("mockderiv", n),
      };
    },
  };

  license = {
    mintLicenseTokens: async (..._args: unknown[]) => {
      const n = ++this.licenseCounter;
      return { licenseTokenIds: [BigInt(n)], txHash: tx("mockmint", n) };
    },
  };

  royalty = {
    payRoyaltyOnBehalf: async (..._args: unknown[]) => ({ txHash: tx("mockpayroyalty", 1) }),
    claimAllRevenue: async (..._args: unknown[]) => ({ txHash: tx("mockclaimall", 1) }),
    claimableRevenue: async (..._args: unknown[]) => BigInt(1000000000000000000),
  };

  dispute = {
    raiseDispute: async (..._args: unknown[]) => {
      const n = ++this.disputeCounter;
      return { disputeId: n, txHash: tx("mockdispute", n) };
    },
    disputeIdToAssertionId: async (..._args: unknown[]) =>
      ("0x" + "assertion".padEnd(64, "0")).slice(0, 66) as `0x${string}`,
    disputeAssertion: async (..._args: unknown[]) => ({ txHash: tx("mockassert", 1) }),
  };

  groupClient = {
    registerGroupAndAttachLicenseAndAddIps: async (..._args: unknown[]) => {
      const n = ++this.groupCounter;
      return {
        groupId: addr(0x6a0000 + n),
        txHash: tx("mockgroup", n),
      };
    },
    addIpsToGroup: async (..._args: unknown[]) => ({ txHash: tx("mockaddips", 1) }),
    collectAndDistributeGroupRoyalties: async (..._args: unknown[]) => ({
      txHash: tx("mockgrouproyalty", 1),
    }),
  };

  wipClient = {
    deposit: async (..._args: unknown[]) => ({ txHash: tx("mockwipdeposit", 1) }),
    approve: async (..._args: unknown[]) => ({ txHash: tx("mockwipapprove", 1) }),
  };
}

export interface MockClients {
  cdr: MockCdr;
  story: MockStory;
  account: { address: `0x${string}` };
}

export function makeMockClients(_addressOrPk: string): MockClients {
  // A valid 20-byte hex address so viem ABI-encoding works in mock scripts.
  const account = { address: "0x000000000000000000000000000000000000dEaD" as `0x${string}` };
  return {
    cdr: makeMockCdr(account.address),
    story: new MockStory(),
    account,
  };
}
