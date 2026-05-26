// Storage helpers: an IPFS/Helia storage provider for the CDR uploader, plus
// content pinning (JSON metadata + raw bytes). In mock mode everything is
// deterministic and offline; the real branch dynamically imports Helia/Pinata so
// mock never has to load them.

import { IS_MOCK, PINATA_JWT } from "./env";

/** Shape the CDR uploader needs from a storage provider. */
export interface StorageProvider {
  CID: (s: string) => unknown;
  [k: string]: unknown;
}

/** A pinned-content reference: an ipfs:// uri and a 0x-prefixed content hash. */
export interface PinResult {
  uri: string;
  hash: `0x${string}`;
}

function toBytes(input: string | Uint8Array): Uint8Array {
  return typeof input === "string" ? new TextEncoder().encode(input) : input;
}

function sha256hex(input: string | Uint8Array): `0x${string}` {
  const bytes = toBytes(input);
  // Prefer node:crypto when in a Node process (identical output to the browser
  // path); fall back to a portable pure-JS sha256 in the browser.
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
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const ml = data.length * 8;
  const withOne = data.length + 1;
  const total = withOne + ((56 - (withOne % 64) + 64) % 64) + 8;
  const msg = new Uint8Array(total);
  msg.set(data);
  msg[data.length] = 0x80;
  // 64-bit big-endian length (high 32 bits assumed 0 for our sizes).
  const dv = new DataView(msg.buffer);
  dv.setUint32(total - 4, ml >>> 0, false);
  dv.setUint32(total - 8, Math.floor(ml / 0x100000000), false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + hh) | 0;
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
}

/**
 * Returns the storage provider object the CDR uploader needs.
 * - Mock: a tiny stub whose `CID` is the identity over a string, with no-op
 *   put/get so callers that touch them don't crash.
 * - Real: a Helia node + @helia/unixfs, exposing `CID:(s)=>CID.parse(s)`.
 *   Imported dynamically so mock never requires helia.
 */
export async function heliaProvider(): Promise<StorageProvider> {
  if (IS_MOCK) {
    return {
      CID: (s: string) => s,
      putFile: async (_bytes: Uint8Array) => undefined,
      getFile: async (_cid: string) => new Uint8Array(),
    };
  }
  // Real Helia provider (dynamic import so the mock path stays dependency-free).
  const { createHelia } = await import("helia");
  const { unixfs } = await import("@helia/unixfs");
  const { CID } = await import("multiformats/cid");
  const helia = await createHelia();
  const fs = unixfs(helia);
  return {
    CID: (s: string) => CID.parse(s),
    helia,
    fs,
    putFile: async (bytes: Uint8Array) => (await fs.addBytes(bytes)).toString(),
    getFile: async (cid: string) => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of fs.cat(CID.parse(cid))) chunks.push(chunk);
      return Buffer.concat(chunks);
    },
  };
}

/**
 * Pin a JSON object to IPFS.
 * - Mock: deterministic `uri="ipfs://mock"+sha256hex`, `hash="0x"+sha256hex`.
 * - Real: pin via pinata-web3 using PINATA_JWT.
 */
export async function pinJSON(obj: unknown): Promise<PinResult> {
  const json = JSON.stringify(obj);
  const hash = sha256hex(json);
  if (IS_MOCK) {
    return { uri: "ipfs://mock" + hash.slice(2), hash };
  }
  // Real pin. VERIFY: pinata-web3 pin shape (PinataSDK.upload.json → IpfsHash).
  const { PinataSDK } = await import("pinata-web3");
  const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });
  const res: any = await pinata.upload.json(obj as object);
  const cid: string = res?.IpfsHash ?? res?.cid ?? "";
  return { uri: "ipfs://" + cid, hash };
}

/**
 * Pin raw bytes to IPFS (used by the public tier "pin in clear").
 * Same result shape as pinJSON.
 */
export async function pinFile(bytes: Uint8Array): Promise<PinResult> {
  const hash = sha256hex(bytes);
  if (IS_MOCK) {
    return { uri: "ipfs://mock" + hash.slice(2), hash };
  }
  // Real pin. VERIFY: pinata-web3 pin shape (PinataSDK.upload.file → IpfsHash).
  const { PinataSDK } = await import("pinata-web3");
  const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });
  const file = new File([Buffer.from(bytes)], "artifact.bin");
  const res: any = await pinata.upload.file(file);
  const cid: string = res?.IpfsHash ?? res?.cid ?? "";
  return { uri: "ipfs://" + cid, hash };
}
