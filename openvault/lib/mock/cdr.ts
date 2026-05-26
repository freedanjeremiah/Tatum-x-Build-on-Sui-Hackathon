// Deterministic in-memory mock of the CDR SDK client.
// Mirrors the subset of @piplabs/cdr-sdk's surface OpenVault uses, with the
// same shape so the rest of the app cannot tell mock from real.
//
// State (vault store + minted tokens) is mirrored to a JSON file under the OS
// temp dir so the Phase-1 flow scripts — which each run as a *separate* process
// (01-upload then 02-download) — observe the same vault. In-process tests are
// unaffected: the file simply round-trips the same data.

// node:fs/os/path are loaded lazily (only in a Node context) so this module can
// also be pulled into a browser bundle — the mock CDR is reachable from client
// components. In the browser the filesystem mirror simply no-ops and state lives
// in-process for the lifetime of the page.

type FsLike = {
  existsSync: (p: string) => boolean;
  mkdirSync: (p: string, o: { recursive: boolean }) => void;
  readFileSync: (p: string, enc: string) => string;
  writeFileSync: (p: string, data: string) => void;
};

function nodeFs(): { fs: FsLike; dir: string; file: string } | null {
  // Only attempt persistence when a real Node process is present.
  const hasProcess =
    typeof process !== "undefined" &&
    !!(process as { versions?: { node?: string } }).versions?.node;
  if (!hasProcess) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const req = eval("require") as (m: string) => unknown;
    const fs = req("node:fs") as FsLike;
    const os = req("node:os") as { tmpdir: () => string };
    const path = req("node:path") as { join: (...p: string[]) => string };
    const dir = path.join(os.tmpdir(), "openvault-mock");
    return { fs, dir, file: path.join(dir, "cdr-state.json") };
  } catch {
    return null;
  }
}

interface StoredEntry {
  ct: number[]; // bytes (JSON-serializable)
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

interface PersistState {
  store: Record<number, StoredEntry>;
  tokens: Record<string, string>;
  uuidCounter: number;
  tokenCounter: number;
}

// In-process fallback store (used in the browser, or if fs is unavailable).
let _memState: PersistState | null = null;

function loadState(): PersistState {
  const node = nodeFs();
  if (node) {
    try {
      if (node.fs.existsSync(node.file)) {
        return JSON.parse(node.fs.readFileSync(node.file, "utf8")) as PersistState;
      }
    } catch {
      /* fall through to empty */
    }
    return { store: {}, tokens: {}, uuidCounter: 0, tokenCounter: 0 };
  }
  // Browser / no-fs: keep state in-process for the page lifetime.
  if (!_memState) {
    _memState = { store: {}, tokens: {}, uuidCounter: 0, tokenCounter: 0 };
  }
  return _memState;
}

function saveState(s: PersistState) {
  const node = nodeFs();
  if (node) {
    try {
      node.fs.mkdirSync(node.dir, { recursive: true });
      node.fs.writeFileSync(node.file, JSON.stringify(s));
    } catch {
      /* best-effort: persistence is only needed for cross-process scripts */
    }
    return;
  }
  _memState = s;
}

export class MockCdr {
  constructor(public readonly owner: string) {}

  uploader = {
    uploadFile: async (args: UploadArgs) => {
      const s = loadState();
      const uuid = ++s.uuidCounter;
      const ipId = String(args.readConditionData ?? "");
      // For the mock we store the plaintext bytes as the "ciphertext".
      s.store[uuid] = { ct: Array.from(args.content), ipId };
      saveState(s);
      return {
        uuid,
        cid: "bafyMock" + uuid,
        txHash: ("0xmockupload" + uuid) as `0x${string}`,
      };
    },

    // Private (allocate-then-write) flow, mock equivalents.
    allocate: async (args: { readConditionData?: string; [k: string]: unknown } = {}) => {
      const s = loadState();
      const uuid = ++s.uuidCounter;
      const ipId = String(args.readConditionData ?? "");
      s.store[uuid] = { ct: [], ipId };
      saveState(s);
      return { uuid, txHash: ("0xmockalloc" + uuid) as `0x${string}` };
    },

    write: async (args: { uuid: number; content: Uint8Array; [k: string]: unknown }) => {
      const s = loadState();
      const entry = s.store[args.uuid];
      if (!entry) throw new Error(`MockCdr.write: unknown uuid ${args.uuid}`);
      entry.ct = Array.from(args.content);
      saveState(s);
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
      const s = loadState();
      const entry = s.store[args.uuid];
      if (!entry) throw new Error(`MockCdr.downloadFile: unknown uuid ${args.uuid}`);
      const aux = args.accessAuxData;
      // Simulate an on-chain access-control revert.
      if (!aux || aux === "0x") {
        throw new Error("MockCdr.downloadFile: missing access token (reverted)");
      }
      const minted = s.tokens[entry.ipId];
      if (!minted || minted !== String(aux)) {
        throw new Error("MockCdr.downloadFile: token not valid for this asset (reverted)");
      }
      return { content: Uint8Array.from(entry.ct) };
    },
  };

  // Mock-only helper: deterministically "mint" a read token for an ipId.
  // Returns the exact value consumer.downloadFile expects as accessAuxData.
  async __mintFor(ipId: string): Promise<string> {
    const s = loadState();
    const existing = s.tokens[ipId];
    if (existing) return existing;
    const tokenId = "mocktoken" + ++s.tokenCounter;
    s.tokens[ipId] = tokenId;
    saveState(s);
    return tokenId;
  }
}

export function makeMockCdr(owner: string): MockCdr {
  return new MockCdr(owner);
}
