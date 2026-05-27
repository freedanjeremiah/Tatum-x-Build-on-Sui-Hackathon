// Real CDR StorageProvider backed by Pinata (IPFS). The CDR uploader encrypts
// the content first, then hands the ciphertext bytes to this provider's upload()
// and records the returned CID on-chain; the consumer later fetches by CID via
// download(). Pinata is used (rather than an in-process Helia node) so that
// uploads survive across processes — the worker/consumer can retrieve them.
//
// Matches @piplabs/cdr-sdk's StorageProvider interface:
//   upload(data: Uint8Array, options?: { pin?: boolean }): Promise<string /*cid*/>
//   download(cid: string): Promise<Uint8Array>

export interface UploadOptions {
  pin?: boolean;
}

export interface StorageProvider {
  upload(data: Uint8Array, options?: UploadOptions): Promise<string>;
  download(cid: string): Promise<Uint8Array>;
}

const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/** Build a Pinata-backed StorageProvider from a Pinata JWT. */
export function pinataStorageProvider(jwt: string): StorageProvider {
  if (!jwt) throw new Error("pinataStorageProvider: missing Pinata JWT");

  return {
    async upload(data: Uint8Array, _options?: UploadOptions): Promise<string> {
      const form = new FormData();
      // Copy into a fresh ArrayBuffer so Blob gets a clean, non-shared view.
      const buf = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      ) as ArrayBuffer;
      form.append("file", new Blob([buf]), "blob");

      const res = await fetch(PIN_FILE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Pinata upload failed (${res.status}): ${body}`);
      }
      const json = (await res.json()) as { IpfsHash?: string };
      if (!json.IpfsHash) {
        throw new Error("Pinata upload: response missing IpfsHash");
      }
      return json.IpfsHash;
    },

    async download(cid: string): Promise<Uint8Array> {
      const res = await fetch(`${GATEWAY}${cid}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Pinata download failed (${res.status}): ${body}`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    },
  };
}
