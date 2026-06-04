// Confidential-compute TEE attestation — config + honest disclosure.
//
// The Seal key-server committee that performs threshold key-delivery can be
// pinned to run inside SGX enclaves: an AttestationConfig makes the read path
// verify each key server's MRENCLAVE / MRSIGNER / SVN and exclude untrusted
// servers from the round — real TEE verification on the key-delivery layer. The
// compute worker (which runs the algorithm over plaintext) is a SEPARATE trust
// layer; a real data-in-use guarantee needs the worker itself inside an attested
// enclave. We disclose which mode it ran in and never claim an enclave we don't have.

import type { AttestationInfo } from "../types/artifact";

/** Expected-measurement config for Seal key-server attestation. */
export interface AttestationConfig {
  minSecurityVersion?: number;
  expectedMrEnclave?: `0x${string}`;
  expectedMrSigner?: `0x${string}`;
}

/** Build a key-server AttestationConfig from env, or undefined if attestation is off. */
export function getAttestationConfig(): AttestationConfig | undefined {
  const mrEnclave = asHex(process.env.SEAL_ATTEST_MRENCLAVE);
  const mrSigner = asHex(process.env.SEAL_ATTEST_MRSIGNER);
  const minSvnRaw = process.env.SEAL_ATTEST_MIN_SVN;
  const minSecurityVersion = minSvnRaw ? Number(minSvnRaw) : undefined;
  const on = !!mrEnclave || !!mrSigner || minSecurityVersion !== undefined || process.env.SEAL_ATTEST === "1";
  if (!on) return undefined;
  const cfg: AttestationConfig = {};
  if (mrEnclave) cfg.expectedMrEnclave = mrEnclave;
  if (mrSigner) cfg.expectedMrSigner = mrSigner;
  if (minSecurityVersion !== undefined && !Number.isNaN(minSecurityVersion)) cfg.minSecurityVersion = minSecurityVersion;
  return cfg;
}

/** Compute-worker isolation mode.
 *  - "enclave-nautilus" — real AWS Nitro enclave; attestation verified on-chain.
 *  - "enclave"          — operator declares this process runs in an attested SGX/TDX enclave.
 *  - "enclave-sim"      — TEE simulator (lib/tee-sim) is active; HONESTLY disclosed as
 *                         NOT hardware-attested. Operator can still see plaintext.
 *  - "plain-server"     — default; plain Node process. */
export function workerIsolation(): "enclave" | "enclave-nautilus" | "enclave-sim" | "plain-server" {
  const mode = process.env.WORKER_ISOLATION_MODE;
  if (mode === "enclave-nautilus" || mode === "nautilus") return "enclave-nautilus";
  if (mode === "enclave") return "enclave";
  if (mode === "enclave-sim" || mode === "sim") return "enclave-sim";
  return "plain-server";
}

/** Expected measurements present -> hard enforcement; else report-only. */
export function attestationEnforced(cfg: AttestationConfig | undefined): boolean {
  return !!(cfg && (cfg.expectedMrEnclave || cfg.expectedMrSigner || cfg.minSecurityVersion !== undefined));
}

/** One-line human disclosure for results/UI. */
export function isolationDisclosure(info: AttestationInfo): string {
  const keyServers = info.validatorAttestationEnabled
    ? info.enforced ? "Seal key-server TEEs attested (enforced)" : "Seal key-server TEEs attested (report-only)"
    : "Seal key-server TEEs not attested";
  const worker =
    info.workerIsolation === "enclave-nautilus"
      ? `compute worker in AWS Nitro enclave — attestation verified on-chain${info.attestationTx ? ` (tx ${info.attestationTx})` : ""}`
      : info.workerIsolation === "enclave"
      ? "compute worker in attested enclave"
      : info.workerIsolation === "enclave-sim"
        ? info.simVerified === true
          ? "compute worker in SIMULATED enclave (TEE-SIM, sim-signature verified — NOT hardware-attested)"
          : info.simVerified === false
            ? "compute worker in SIMULATED enclave (TEE-SIM, sim-signature INVALID — NOT hardware-attested)"
            : "compute worker in SIMULATED enclave (TEE-SIM declared but no sim-attestation step reached — NOT hardware-attested)"
        : "compute worker on plain server (operator-trusted, demo)";
  return `${worker}; ${keyServers}`;
}

function asHex(v: string | undefined): `0x${string}` | undefined {
  if (!v) return undefined;
  return (v.startsWith("0x") ? v : "0x" + v) as `0x${string}`;
}
