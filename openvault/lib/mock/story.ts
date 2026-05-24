// Deterministic in-memory mock of the Story Protocol core SDK client, plus the
// makeMockClients() factory that pairs it with a MockCdr. Each instance keeps
// its own counters so nothing leaks across instances.

import { MockCdr, makeMockCdr } from "./cdr";

const tx = (label: string, n: number) => ("0x" + label + n) as `0x${string}`;

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
        ipId: ("0x" + "ip".padEnd(38, "0") + n).slice(0, 42) as `0x${string}`,
        licenseTermsId: "100" + n,
        tokenId: BigInt(n),
        txHash: tx("mockregip", n),
      };
    },
    registerDerivativeIpAsset: async (..._args: unknown[]) => {
      const n = ++this.childCounter;
      return {
        ipId: ("0x" + "child".padEnd(38, "0") + n).slice(0, 42) as `0x${string}`,
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
        groupId: ("0x" + "group".padEnd(38, "0") + n).slice(0, 42) as `0x${string}`,
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
  const account = { address: "0xMockOwner000000000000000000000000000000000" as `0x${string}` };
  return {
    cdr: makeMockCdr(account.address),
    story: new MockStory(),
    account,
  };
}
