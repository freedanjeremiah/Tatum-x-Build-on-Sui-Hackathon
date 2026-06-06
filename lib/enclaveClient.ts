// lib/enclaveClient.ts — SERVER ONLY. POSTs a compute job to the Nautilus
// enclave's process_data endpoint and returns the enclave-signed result.
export const ENCLAVE_URL_ENV = "ENCLAVE_PROCESS_URL";

export interface EnclaveJob {
  datasetIpId: string;
  algoHash: string;
  params?: Record<string, unknown>;
  /** Dataset descriptor (cid/tier/allowedAlgoHashes) so the in-enclave worker can
   *  resolve the Walrus blob + satisfy the allowlist gate and actually decrypt. */
  dataset?: Record<string, unknown>;
  /** Dataset's algo allowlist (mirrors dataset.allowedAlgoHashes). */
  allowedAlgoHashes?: string[];
}

export interface EnclaveSignedResult {
  metrics: Record<string, number>;
  /** The EXACT bytes the enclave signed as the metrics field — forwarded verbatim on-chain. */
  metricsBytes: Uint8Array;
  timestampMs: bigint;
  /** raw ed25519 signature bytes (64). */
  signature: Uint8Array;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function callEnclave(job: EnclaveJob): Promise<EnclaveSignedResult> {
  const url = process.env[ENCLAVE_URL_ENV];
  if (!url) throw new Error(`enclave: ${ENCLAVE_URL_ENV} is not set — cannot run attested compute`);
  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/process_data`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(job),
    });
  } catch (e) {
    throw new Error(`enclave: process_data unreachable — ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`enclave: process_data returned ${res.status}`);
  const j = (await res.json()) as {
    response: { intent: number; timestamp_ms: number; data: { metrics: Record<string, number>; metrics_b64?: string } };
    signature: string;
  };
  const metrics_b64 = j.response.data.metrics_b64;
  if (!metrics_b64) {
    throw new Error("enclave: response missing metrics_b64 — cannot forward signed bytes");
  }
  const metricsBytes = new Uint8Array(Buffer.from(metrics_b64, "base64"));
  return {
    metrics: j.response.data.metrics,
    metricsBytes,
    timestampMs: BigInt(j.response.timestamp_ms),
    signature: hexToBytes(j.signature),
  };
}
