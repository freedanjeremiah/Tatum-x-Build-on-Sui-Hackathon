// Publishes raw bytes to Walrus server-side so the storage signer never reaches
// the browser. The bytes are PUBLIC by design: for gated/compute artifacts they
// are Seal CIPHERTEXT (encrypted client-side — the server never sees plaintext);
// for the public tier they are the cleartext the user chose to publish. This route
// holds no keys and gates no access; it only stores the blob and returns its id.

export const runtime = "nodejs"; // Edge unsupported (uses node fetch + secret env)

import { pinFile } from "@/lib/storage";

export async function POST(req: Request): Promise<Response> {
  const buf = await req.arrayBuffer();
  if (!buf || buf.byteLength === 0) {
    return new Response(JSON.stringify({ error: "empty body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    // Runs in Node → pinFile publishes to Walrus with the server signer.
    const { uri, hash } = await pinFile(new Uint8Array(buf));
    const cid = uri.replace(/^walrus:\/\//, "");
    return new Response(JSON.stringify({ cid, uri, hash }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}
