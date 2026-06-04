// Runtime introspection — read-only.
// Reports the SERVER-DECLARED isolation mode + Seal key-server attestation config
// so the UI can render honest disclosures BEFORE any compute job runs. No secrets,
// no signer state — just the declared posture of the running process.

export const runtime = "nodejs";

import {
  workerIsolation,
  getAttestationConfig,
  attestationEnforced,
} from "@/lib/attestation";

export async function GET(): Promise<Response> {
  const cfg = getAttestationConfig();
  const body = {
    workerIsolation: workerIsolation(),
    keyServers: {
      attestationEnabled: !!cfg,
      enforced: attestationEnforced(cfg),
      expectedMrEnclave: cfg?.expectedMrEnclave ?? null,
      expectedMrSigner: cfg?.expectedMrSigner ?? null,
      minSecurityVersion: cfg?.minSecurityVersion ?? null,
    },
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      // Keep the disclosure live — UI may revisit between mode changes during
      // a hot reload.
      "cache-control": "no-store",
    },
  });
}
