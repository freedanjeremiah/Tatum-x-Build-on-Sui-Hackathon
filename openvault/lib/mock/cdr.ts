// Deterministic in-memory mock of the CDR SDK client.
// Mirrors the subset of @piplabs/cdr-sdk's surface OpenVault uses, with the
// same shape so the rest of the app cannot tell mock from real.

interface StoredEntry {
  ct: Uint8Array;
  ipId: string;
}

interface UploadArgs {
  content: Uint8Array;
  readConditionData: string; // carries the ipId for mock gating
  [k: string]: unknown;
}

interface DownloadArgs {
  uuid: number;
  accessAuxData: string; // a minted tokenId, or "0x"/falsy when none
  [k: string]: unknown;
}

export class MockCdr {
  private store = new Map<number, StoredEntry>();
  private tokens = new Map<string, string>(); // ipId -> tokenId
  private uuidCounter = 0;
  private tokenCounter = 0;

  constructor(public readonly owner: string) {}

  uploader = {
    uploadFile: async (args: UploadArgs) => {
      const uuid = ++this.uuidCounter;
      const ipId = String(args.readConditionData ?? "");
      // For the mock we store the plaintext bytes as the "ciphertext".
      this.store.set(uuid, { ct: args.content, ipId });
      return {
        uuid,
        cid: "bafyMock" + uuid,
        txHash: ("0xmockupload" + uuid) as `0x${string}`,
      };
    },

    // Private (allocate-then-write) flow, mock equivalents.
    allocate: async (args: { readConditionData?: string; [k: string]: unknown } = {}) => {
      const uuid = ++this.uuidCounter;
      const ipId = String(args.readConditionData ?? "");
      this.store.set(uuid, { ct: new Uint8Array(0), ipId });
      return { uuid, txHash: ("0xmockalloc" + uuid) as `0x${string}` };
    },

    write: async (args: { uuid: number; content: Uint8Array; [k: string]: unknown }) => {
      const entry = this.store.get(args.uuid);
      if (!entry) throw new Error(`MockCdr.write: unknown uuid ${args.uuid}`);
      entry.ct = args.content;
      return {
        uuid: args.uuid,
        cid: "bafyMock" + args.uuid,
        txHash: ("0xmockwrite" + args.uuid) as `0x${string}`,
      };
    },
  };

  observer = {
    getGlobalPubKey: async () => "0xMockGlobalPubKey0000000000000000000000000000000000000000000000",
  };

  consumer = {
    downloadFile: async (args: DownloadArgs) => {
      const entry = this.store.get(args.uuid);
      if (!entry) throw new Error(`MockCdr.downloadFile: unknown uuid ${args.uuid}`);
      const aux = args.accessAuxData;
      // Simulate an on-chain access-control revert.
      if (!aux || aux === "0x") {
        throw new Error("MockCdr.downloadFile: missing access token (reverted)");
      }
      const minted = this.tokens.get(entry.ipId);
      if (!minted || minted !== String(aux)) {
        throw new Error("MockCdr.downloadFile: token not valid for this asset (reverted)");
      }
      return { content: entry.ct };
    },
  };

  // Mock-only helper: deterministically "mint" a read token for an ipId.
  async __mintFor(ipId: string): Promise<string> {
    const existing = this.tokens.get(ipId);
    if (existing) return existing;
    const tokenId = "mocktoken" + ++this.tokenCounter;
    this.tokens.set(ipId, tokenId);
    return tokenId;
  }
}

export function makeMockCdr(owner: string): MockCdr {
  return new MockCdr(owner);
}
