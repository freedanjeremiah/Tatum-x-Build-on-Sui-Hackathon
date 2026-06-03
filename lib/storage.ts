// Storage layer — Walrus blobs. Tessera migration A3.
// Replaces the old Pinata/IPFS storage with @mysten/walrus WalrusClient.
//
// Design:
//   - Storage class (canonical API): publishBlob, publishQuilt, read, readMany,
//     readViaAggregator, readQuiltPatch, extend, deleteBlob, currentEpoch.
//   - Ciphertext guard: refuses to publish payloads whose first byte looks like
//     JSON/whitespace (defense in depth — Seal encryption happens in lib/crypto.ts
//     before this layer is called, but we guard here too per invariant #7).
//   - Write-retry: transient committee/epoch/certification faults are retried up
//     to 3× with cache reset (same pattern as sharegraph storage.ts).
//   - Compat shims at the bottom: pinJSON, pinFile, heliaProvider, storageProvider
//     keep existing callers (lib/artifacts.ts, lib/metadata.ts, API routes, worker,
//     scripts) compiling unchanged. A Walrus blobId takes the role the IPFS CID had.
//
// Config sourced from lib/constants.ts (WALRUS_AGGREGATOR, SUI_NETWORK,
// STORAGE_EPOCHS). SuiClient obtained from lib/clients.ts (getReadClient()).
// Do NOT import from sharegraph; this is an independent adaptation.

import { WalrusClient } from "@mysten/walrus";
import { WalrusFile } from "@mysten/walrus";
import type { Signer } from "@mysten/sui/cryptography";
import type { SuiClient } from "./clients";
import { getReadClient } from "./clients";
import {
  WALRUS_AGGREGATOR,
  SUI_NETWORK,
  STORAGE_EPOCHS,
} from "./constants";

// ---------------------------------------------------------------------------
// Primitive type aliases (local equivalents of sharegraph types.ts)
// ---------------------------------------------------------------------------

export type BlobId = string;       // Walrus blob or quilt id
export type SuiObjectId = string;  // on-chain Move object id
export type SuiAddress = string;   // 0x-prefixed 32-byte hex

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface StorageConfig {
  /** "testnet" | "mainnet" */
  network: "testnet" | "mainnet";
  suiClient: SuiClient;
  /** Public, gasless Walrus aggregator endpoint. */
  aggregatorUrl: string;
  /** Browser: URL to @mysten/walrus-wasm/web/walrus_wasm_bg.wasm */
  wasmUrl?: string;
}

export interface PublishResult {
  blobId: BlobId;
  blobObjectId: SuiObjectId;
  endEpoch: number;
}

export interface QuiltPublishResult extends PublishResult {
  /** identifier → quilt patch blobId */
  patches: Record<string, BlobId>;
}

export interface PublishOpts {
  /** Pays gas + WAL. */
  signer: Signer;
  /** Blob object owner (on-chain). */
  owner: SuiAddress;
  /** How many Walrus epochs to store. */
  epochs: number;
  /** Whether the blob is deletable (default true — allows GC of old versions). */
  deletable?: boolean;
}

// ---------------------------------------------------------------------------
// Storage class
// ---------------------------------------------------------------------------

export class Storage {
  readonly walrus: WalrusClient;
  private readonly aggregator: string;
  private readonly suiClient: SuiClient;

  constructor(cfg: StorageConfig) {
    this.suiClient = cfg.suiClient;
    this.walrus = new WalrusClient({
      network: cfg.network,
      suiClient: cfg.suiClient as never,
      ...(cfg.wasmUrl ? { wasmUrl: cfg.wasmUrl } : {}),
    });
    this.aggregator = cfg.aggregatorUrl.replace(/\/$/, "");
  }

  /**
   * Drop the client's cached coin/object reads so the next coin-selecting write
   * sees the post-spend coin set. Without this, sequential writes from one wallet
   * can build against an already-spent coin → `balance::split` abort.
   */
  private freshen(): void {
    try {
      (this.suiClient as any).cache?.clear?.();
      this.walrus.reset();
    } catch {
      /* cache clear is best-effort */
    }
  }

  /**
   * Retry a Walrus write on transient committee/epoch/certification faults.
   * writeBlob/writeQuilt span register → store slivers → certify in one call;
   * if the Walrus epoch rolls or the cached committee is stale mid-write, certify
   * hits a MoveAbort (e.g. messages::new_certified_message code 1). Reset the
   * client's cached committee + coins and retry — a genuine NoAccess/policy abort
   * never originates from these system calls, so scoping retry to publishes is safe.
   */
  private async withWriteRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const msg = (e as Error)?.message ?? "";
        const transient =
          /new_certified_message|certif|MoveAbort|epoch|committee|Inconsistent|notEnough|NotEnough|sliver|timed? ?out|timeout|ECONNRESET|fetch failed|50[0-9]\b|retry/i.test(
            msg
          );
        if (!transient || i === attempts - 1) throw e;
        this.freshen();
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
    throw lastErr;
  }

  /**
   * Guard against accidentally publishing plaintext (invariant #7/#10). Seal
   * ciphertext is BCS and never begins with a JSON/whitespace marker.
   *   0x7b = '{'   0x5b = '['   0x20 = ' '   0x22 = '"'
   */
  private assertCiphertext(bytes: Uint8Array): void {
    const b = bytes[0];
    if (b === 0x7b || b === 0x5b || b === 0x20 || b === 0x22) {
      throw new Error(
        "refusing to publish: payload looks like plaintext, not Seal ciphertext (invariant #7)"
      );
    }
  }

  /** Publish one ciphertext blob, owned by `owner`, paid by `signer`. */
  async publishBlob(ciphertext: Uint8Array, opts: PublishOpts): Promise<PublishResult> {
    this.assertCiphertext(ciphertext);
    this.freshen();
    const { blobId, blobObject } = await this.withWriteRetry(() =>
      this.walrus.writeBlob({
        blob: ciphertext,
        deletable: opts.deletable ?? true,
        epochs: opts.epochs,
        signer: opts.signer,
        owner: opts.owner,
      })
    );
    return {
      blobId,
      blobObjectId: blobObject.id,
      endEpoch: Number(blobObject.storage.end_epoch),
    };
  }

  /**
   * Publish many ciphertext entries as ONE Quilt (cheap for many small blobs).
   * Returns the quilt id + per-identifier patch ids.
   */
  async publishQuilt(
    items: { identifier: string; contents: Uint8Array; tags?: Record<string, string> }[],
    opts: PublishOpts
  ): Promise<QuiltPublishResult> {
    for (const it of items) this.assertCiphertext(it.contents);
    this.freshen();
    const res = await this.withWriteRetry(() =>
      this.walrus.writeQuilt({
        blobs: items,
        deletable: opts.deletable ?? true,
        epochs: opts.epochs,
        signer: opts.signer,
        owner: opts.owner,
      })
    );
    const patches: Record<string, BlobId> = {};
    for (const p of res.index.patches) patches[p.identifier] = p.patchId;
    return {
      blobId: res.blobId,
      blobObjectId: res.blobObject.id,
      endEpoch: Number(res.blobObject.storage.end_epoch),
      patches,
    };
  }

  /** Read a blob or quilt-patch by id (handles both via SDK getFiles). */
  async read(id: BlobId): Promise<Uint8Array> {
    const files = await this.walrus.getFiles({ ids: [id] });
    if (!files[0]) throw new Error(`blob not found: ${id}`);
    return files[0].bytes();
  }

  /** Batch read (efficient for many patches from the same quilt). */
  async readMany(ids: BlobId[]): Promise<Uint8Array[]> {
    if (ids.length === 0) return [];
    const files = await this.walrus.getFiles({ ids });
    return Promise.all(files.map((f) => f.bytes()));
  }

  /**
   * Gasless read of a whole blob via the public aggregator (no SDK/wasm).
   * Retries on 404/5xx: a freshly-certified blob can lag a few seconds before
   * it propagates to the aggregator.
   */
  async readViaAggregator(blobId: BlobId, retries = 6): Promise<Uint8Array> {
    return this.fetchWithRetry(
      `${this.aggregator}/v1/blobs/${blobId}`,
      blobId,
      retries
    );
  }

  /**
   * Gasless read of a single Quilt patch by its patch id via the aggregator.
   * Returns the exact patch bytes (one EncryptedObject).
   */
  async readQuiltPatch(patchId: BlobId, retries = 6): Promise<Uint8Array> {
    return this.fetchWithRetry(
      `${this.aggregator}/v1/blobs/by-quilt-patch-id/${patchId}`,
      patchId,
      retries
    );
  }

  private async fetchWithRetry(
    url: string,
    id: string,
    retries: number
  ): Promise<Uint8Array> {
    let delay = 800;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url);
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
        if (res.status < 500 && res.status !== 404)
          throw new Error(`aggregator ${res.status} for ${id}`);
        if (attempt >= retries)
          throw new Error(`aggregator read failed ${res.status} for ${id}`);
      } catch (e) {
        if (attempt >= retries) throw e;
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.6, 5000);
    }
  }

  /**
   * Extend storage for a blob by `epochs` (renewal). Funder `signer` pays + must
   * own the Blob object.
   */
  async extend(blobObjectId: SuiObjectId, epochs: number, signer: Signer): Promise<string> {
    this.freshen();
    const { digest } = await this.walrus.executeExtendBlobTransaction({
      blobObjectId,
      epochs,
      signer,
    });
    return digest;
  }

  /** Delete a deletable blob to reclaim storage (GC of superseded versions). Owner signs. */
  async deleteBlob(blobObjectId: SuiObjectId, signer: Signer): Promise<string> {
    this.freshen();
    const { digest } = await this.walrus.executeDeleteBlobTransaction({
      blobObjectId,
      signer,
    });
    return digest;
  }

  /** Current Walrus epoch (for renewal decisions). */
  async currentEpoch(): Promise<number> {
    const s = await this.walrus.systemState();
    return s.committee.epoch;
  }

  /** Utility: wrap raw bytes + identifier for use with publishQuilt. */
  static makeFile(
    identifier: string,
    contents: Uint8Array,
    tags?: Record<string, string>
  ): WalrusFile {
    return WalrusFile.from({ identifier, contents, tags });
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _storage: Storage | undefined;

/**
 * Returns a shared read-configured Storage singleton (no signer — read paths only).
 * Config is sourced from lib/constants.ts. Fails loudly if WALRUS_AGGREGATOR is
 * missing or if SUI_NETWORK is not "testnet" or "mainnet".
 */
export function getStorage(wasmUrl?: string): Storage {
  if (_storage) return _storage;

  if (!WALRUS_AGGREGATOR) {
    throw new Error(
      "Missing WALRUS_AGGREGATOR — set NEXT_PUBLIC_OV_WALRUS_AGGREGATOR or OV_WALRUS_AGGREGATOR"
    );
  }
  const network = SUI_NETWORK as "testnet" | "mainnet";
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error(
      `Invalid SUI_NETWORK "${SUI_NETWORK}": Walrus only supports "testnet" or "mainnet"`
    );
  }

  _storage = new Storage({
    network,
    suiClient: getReadClient(),
    aggregatorUrl: WALRUS_AGGREGATOR,
    ...(wasmUrl ? { wasmUrl } : {}),
  });
  return _storage;
}

// ---------------------------------------------------------------------------
// Compatibility shims — preserve the old Pinata-era caller-facing API so
// existing callers (lib/artifacts.ts, lib/metadata.ts, app/api/pin*, worker,
// scripts) keep compiling without changes in this task (Phase B will migrate
// them properly).
//
// Mapping:
//   pinJSON(obj)       → publishes JSON bytes as a Walrus blob via aggregator
//                        upload; returns { uri: "walrus://<blobId>", hash }
//                        NOTE: pinJSON on the write path requires a signer —
//                        callers that used the CDR storageProvider path (helia-
//                        Provider / storageProvider) are NOT affected because
//                        those callers pass bytes through cdr.uploader directly.
//                        pinJSON is called only from lib/metadata.ts for public
//                        metadata pinning; in Phase B it will be migrated to an
//                        on-chain metadata scheme or an off-chain DB. For now we
//                        fall back to the aggregator for reads and throw on writes
//                        that lack a signer, so the existing shape is preserved
//                        without silently losing data.
//
//   pinFile(bytes)     → same as pinJSON but for raw bytes
//   heliaProvider()    → returns a compat StorageProvider (upload/download via
//                        Walrus aggregator HTTP — no signer = read-only in the
//                        new model; upload path deferred to Phase B CDR swap)
//   storageProvider()  → alias for heliaProvider
// ---------------------------------------------------------------------------

/** A pinned-content reference: a walrus:// URI and a 0x-prefixed content hash. */
export interface PinResult {
  uri: string;
  hash: `0x${string}`;
}

/**
 * Loose StorageProvider shape (mirrors the old Pinata StorageProvider). The
 * real provider (lib/pinataStorage) implemented the CDR SDK's
 * `upload(data, opts)→cid` / `download(cid)→bytes` contract. This compat shim
 * keeps the same shape so CDR-consuming callers keep compiling; Phase B will
 * replace the CDR vault with a Walrus+Seal equivalent.
 */
export interface StorageProvider {
  /** Optional identity helper over a content-id string. */
  CID?: (s: string) => unknown;
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// Internal: SHA-256 (node:crypto in Node, pure-JS fallback in browser)
// ---------------------------------------------------------------------------

function sha256hex(input: string | Uint8Array): `0x${string}` {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const hasNode =
    typeof process !== "undefined" &&
    !!(process as { versions?: { node?: string } }).versions?.node;
  if (hasNode) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const req = eval("require") as (m: string) => unknown;
      const { createHash } = req("node:crypto") as {
        createHash: (a: string) => {
          update: (b: Uint8Array) => { digest: (e: string) => string };
        };
      };
      return ("0x" + createHash("sha256").update(bytes).digest("hex")) as `0x${string}`;
    } catch {
      /* fall through to JS impl */
    }
  }
  return ("0x" + sha256js(bytes)) as `0x${string}`;
}

// Minimal, dependency-free SHA-256 (FIPS 180-4) for the browser path.
function sha256js(data: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a;
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const ml = data.length * 8;
  const withOne = data.length + 1;
  const total = withOne + ((56 - (withOne % 64) + 64) % 64) + 8;
  const msg = new Uint8Array(total);
  msg.set(data);
  msg[data.length] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(total - 4, ml >>> 0, false);
  dv.setUint32(total - 8, Math.floor(ml / 0x100000000), false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 =
        rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      hh = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + hh) | 0;
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return (
    toHex(h0) +
    toHex(h1) +
    toHex(h2) +
    toHex(h3) +
    toHex(h4) +
    toHex(h5) +
    toHex(h6) +
    toHex(h7)
  );
}

// ---------------------------------------------------------------------------
// Compat shim: pinJSON
// Old: pinned to IPFS via Pinata, returned { uri: "ipfs://<CID>", hash }
// New: publishes bytes to Walrus via aggregator URL; returns
//      { uri: "walrus://<blobId>", hash }.
//
// WRITE NOTE: The old pinJSON called Pinata directly from Node (JWT path) or
// via /api/pin (browser path). In the Walrus world, writing requires a signer
// (WAL fee + gas). Callers that relied on JWT-only server-side writes (metadata
// pinning in lib/metadata.ts, /api/pin) will need Phase B wiring to supply a
// signer. For now we surface a clear error rather than silently losing data.
// The /api/pin route still calls this — it will fail until Phase B migrates
// metadata storage (e.g. to Sui objects or an off-chain store).
// ---------------------------------------------------------------------------

/**
 * Pin a JSON object to Walrus.
 * COMPAT SHIM — replaces the old Pinata pinJSON. A blobId takes the CID role.
 * uri format: "walrus://<blobId>"  hash: sha256 of the canonical JSON.
 *
 * WRITE path requires a signer (not available in this shim layer); throws
 * with a clear message directing callers to Phase B migration.
 */
export async function pinJSON(obj: unknown): Promise<PinResult> {
  const json = JSON.stringify(obj);
  const hash = sha256hex(json);
  // Phase B: this shim throws until the metadata store is migrated to Walrus
  // with a proper signer. The /api/pin route and lib/metadata.ts must be
  // updated in Phase B to supply a Signer obtained from the wallet or server key.
  throw new Error(
    "pinJSON: Pinata removed (A3 migration). Metadata writes require a Walrus signer — " +
    "migrate lib/metadata.ts and /api/pin to use Storage.publishBlob() with a server keypair (Phase B). " +
    `(Would have hashed: ${hash})`
  );
}

/**
 * Pin raw bytes to Walrus.
 * COMPAT SHIM — replaces the old Pinata pinFile. A blobId takes the CID role.
 * uri format: "walrus://<blobId>"  hash: sha256 of the bytes.
 *
 * WRITE path requires a signer; throws with a clear migration message.
 */
export async function pinFile(bytes: Uint8Array): Promise<PinResult> {
  const hash = sha256hex(bytes);
  throw new Error(
    "pinFile: Pinata removed (A3 migration). File writes require a Walrus signer — " +
    "migrate callers to use Storage.publishBlob() with a server keypair (Phase B). " +
    `(Would have hashed: ${hash})`
  );
}

/**
 * Returns a Walrus-backed StorageProvider for compatibility with the CDR SDK.
 * Upload still requires a signer — this shim returns a provider whose upload()
 * throws with a migration message. Download delegates to the aggregator (gasless).
 *
 * COMPAT SHIM — old name was heliaProvider / storageProvider.
 * Phase B will replace the CDR vault wiring entirely (Walrus + Seal path).
 */
export async function storageProvider(): Promise<StorageProvider> {
  const storage = getStorage();
  return {
    CID: (s: string) => s,
    async upload(_data: Uint8Array): Promise<string> {
      throw new Error(
        "storageProvider.upload: Pinata removed (A3 migration). CDR vault writes are being " +
        "replaced with Walrus+Seal in Phase B. Use Storage.publishBlob() with a signer directly."
      );
    },
    async download(blobId: string): Promise<Uint8Array> {
      // Gasless aggregator read — works without a signer.
      return storage.readViaAggregator(blobId);
    },
  };
}

/**
 * Deprecated alias for backwards compatibility.
 * @deprecated Use `storageProvider()` or `getStorage()` directly.
 */
export const heliaProvider = storageProvider;
