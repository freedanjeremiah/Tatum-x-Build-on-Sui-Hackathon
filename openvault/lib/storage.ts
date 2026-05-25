// Storage helpers: an IPFS/Helia storage provider for the CDR uploader, plus
// content pinning (JSON metadata + raw bytes). In mock mode everything is
// deterministic and offline; the real branch dynamically imports Helia/Pinata so
// mock never has to load them.

import { createHash } from "node:crypto";
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

function sha256hex(input: string | Uint8Array): `0x${string}` {
  const buf = typeof input === "string" ? Buffer.from(input) : Buffer.from(input);
  return ("0x" + createHash("sha256").update(buf).digest("hex")) as `0x${string}`;
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
