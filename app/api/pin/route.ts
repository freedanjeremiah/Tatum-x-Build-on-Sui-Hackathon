// Pins PUBLIC metadata only — no secrets, no plaintext artifact bytes.
// This route pins a PUBLIC metadata JSON object (title/description/tags/
// creators/etc.) to IPFS. It NEVER handles decryption keys or raw artifact
// payloads; those never touch the backend (the CDR vault is client-side).

export const runtime = "nodejs"; // Edge unsupported for sqlite/CDR

import { pinJSON } from "@/lib/storage";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  if (body === undefined || body === null || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "missing or invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { uri, hash } = await pinJSON(body);
  return new Response(JSON.stringify({ uri, hash }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
