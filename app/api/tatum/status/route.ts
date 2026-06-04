// Tatum network/gas status — read-only.
//
// Surfaces live Sui chain status (reference gas price, latest checkpoint,
// epoch) fetched server-side through the Tatum Sui gateway, so the UI can show
// that RPC + data flow via Tatum. The TATUM_API_KEY NEVER leaves the server —
// this route reads it, calls Tatum, and returns only the public numbers.
//
// Honest when disabled: if no key is configured, returns { configured: false }
// and the UI renders "—" rather than any fabricated value.

export const runtime = "nodejs";

import { hasTatumKey, tatumNetworkStatus } from "@/lib/tatum";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function GET(): Promise<Response> {
  if (!hasTatumKey()) {
    // Honest disabled state — never invent numbers.
    return json({ configured: false, via: "tatum" });
  }
  try {
    const status = await tatumNetworkStatus();
    return json({ configured: true, via: "tatum", ...status });
  } catch (e) {
    // Reachable-but-failing (rate limit, transient gateway error). Honest error,
    // no fabricated data; UI falls back to "—".
    return json({ configured: true, via: "tatum", error: (e as Error).message }, 502);
  }
}
