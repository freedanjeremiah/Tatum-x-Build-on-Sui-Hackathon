// Enclave simulator (HONEST, NEVER claims real hardware attestation).
//
// Produces a structurally-valid, deterministically-signed "simulated SGX quote"
// for the compute worker process. The shape mirrors an Intel SGX ECDSA quote
// (header + report body + signature) so that callers can exercise the same
// verification code paths they would use for a real attestation, without ever
// having to pretend a plain Node process is a real enclave.
//
// What makes it HONEST (and not a forgery surface):
//
//  1. `kind: "sim-sgx-quote"` is encoded in the header and re-asserted by every
//     verify call. A real attestation verifier (Intel DCAP, Microsoft Azure
//     Attestation, the CDR validator chain) will REJECT this kind out of hand
//     because the signature is an HMAC over a server-side secret, not an
//     ECDSA-P256 signature chained to an Intel quoting enclave certificate.
//
//  2. The disclosure string ("Simulated enclave — cryptographically unverified
//     by hardware; do not trust for production data") is bundled INTO the quote
//     itself, so any sink that displays the quote also displays the disclosure.
//
//  3. The HMAC uses a per-worker secret (`WORKER_SIM_KEY` or a derived default).
//     If a downstream system silently treats sim quotes as hardware quotes, the
//     verify() function still flags the mode as `"sim"` so the consumer always
//     knows.
//
// This file is SERVER-ONLY (uses node:crypto). The browser never imports it.

import { createHash, createHmac } from "node:crypto";

export interface SimQuoteHeader {
  /** Distinguishes sim quotes from real Intel SGX quotes. Never "SGX". */
  teeType: "SGX-SIM";
  /** Mirrors Intel quote header version (2 = ECDSA). 1 here = sim v1. */
  version: 1;
  /** Quoting Enclave SVN (simulated identity). */
  qeSvn: number;
  /** Provisioning Certification Enclave SVN. */
  pceSvn: number;
  /** Vendor id of the simulated QE. */
  qeVendorId: string;
}

export interface SimQuoteBody {
  /** Measurement of the running enclave code (= sha256 of the worker identity bundle). */
  mrEnclave: `0x${string}`;
  /** Measurement of the signer of the enclave (= sha256 of the operator address). */
  mrSigner: `0x${string}`;
  /** Product id (matches the dataset's compute terms in real deployments). */
  isvProdId: number;
  /** Security version of the enclave code. */
  isvSvn: number;
  /** 64-byte user data — binds the quote to a job/algorithm hash. */
  reportData: `0x${string}`;
}

export interface SimulatedQuote {
  /** Hard-coded marker that downstream code can switch on. */
  kind: "sim-sgx-quote";
  header: SimQuoteHeader;
  body: SimQuoteBody;
  /** HMAC-SHA256 over canonical JSON(header+body) keyed by the sim secret. */
  signature: `0x${string}`;
  /** ISO timestamp of generation. */
  generatedAt: string;
  /** Human-readable disclosure shipped INSIDE the quote. */
  disclosure: string;
}

export interface SimQuoteInput {
  /** Worker process identity (EOA address that signs derivatives). */
  workerIdentity: `0x${string}`;
  /** Compute algorithm hash being run. Binds the quote to a measurement. */
  algoHash: string;
  /** Optional per-job nonce for replay protection. */
  jobNonce?: string;
  /** Override the simulated QE/PCE SVNs. Defaults to 1/1. */
  qeSvn?: number;
  pceSvn?: number;
  /** Override the simulated ISV SVN. Defaults to 1. */
  isvSvn?: number;
}

export interface SimVerifyExpected {
  /** Require this mrEnclave (sha256 of the expected worker bundle). */
  expectedMrEnclave?: `0x${string}`;
  /** Require this mrSigner (sha256 of the expected operator address). */
  expectedMrSigner?: `0x${string}`;
  /** Require isvSvn >= this minimum. */
  minSecurityVersion?: number;
}

export interface SimVerifyResult {
  ok: boolean;
  /** Always "sim" so the consumer never confuses this with hardware attestation. */
  mode: "sim";
  reasons: string[];
}

const SIM_SECRET_ENV = "WORKER_SIM_KEY";
const DEFAULT_SECRET_SEED = "openvault-tee-sim-default-secret-v1";
const QE_VENDOR_ID_SIM = "OV-SIM-QE";
const DISCLOSURE =
  "Simulated enclave (TEE-SIM v1) — cryptographically UNVERIFIED by hardware. Do NOT trust for production data; operator can still see plaintext in memory. Use only for development/CI.";

/** Resolve the HMAC secret. Per-deployment override via env, else deterministic default. */
function simSecret(): Buffer {
  const fromEnv = process.env[SIM_SECRET_ENV];
  if (fromEnv && fromEnv.length > 0) return Buffer.from(fromEnv, "utf8");
  return Buffer.from(DEFAULT_SECRET_SEED, "utf8");
}

function sha256Hex(input: string): `0x${string}` {
  return ("0x" + createHash("sha256").update(input).digest("hex")) as `0x${string}`;
}

/** Build the canonical byte string used for hashing/signing (stable key order). */
function canonical(header: SimQuoteHeader, body: SimQuoteBody): string {
  return JSON.stringify({
    teeType: header.teeType,
    version: header.version,
    qeSvn: header.qeSvn,
    pceSvn: header.pceSvn,
    qeVendorId: header.qeVendorId,
    mrEnclave: body.mrEnclave,
    mrSigner: body.mrSigner,
    isvProdId: body.isvProdId,
    isvSvn: body.isvSvn,
    reportData: body.reportData,
  });
}

/**
 * Generate a simulated quote for the compute worker.
 *
 * Deterministic for a given (workerIdentity, algoHash, jobNonce) tuple — useful
 * for tests. Always carries the `disclosure` string and `kind:"sim-sgx-quote"`.
 */
export function generateSimulatedQuote(input: SimQuoteInput): SimulatedQuote {
  const header: SimQuoteHeader = {
    teeType: "SGX-SIM",
    version: 1,
    qeSvn: input.qeSvn ?? 1,
    pceSvn: input.pceSvn ?? 1,
    qeVendorId: QE_VENDOR_ID_SIM,
  };
  // mrEnclave = sha256 of the (worker EOA + algo hash). Distinguishes the
  // running code AND the algorithm. Real MRENCLAVE is sha256 of enclave pages
  // measured at load — this is the simulator equivalent for our scope.
  const mrEnclave = sha256Hex(`enclave:${input.workerIdentity}:${input.algoHash}`);
  // mrSigner = sha256 of the operator address. Real MRSIGNER is sha256 of the
  // RSA-3072 public key of the enclave signer. For sim, the operator's EOA is
  // the analogous identity anchor.
  const mrSigner = sha256Hex(`signer:${input.workerIdentity}`);
  // reportData binds the quote to the algo + nonce so the verifier knows what
  // ran. 32 bytes of sha256 in front, zero-padded to the 64-byte SGX field.
  const bindInner = sha256Hex(`report:${input.algoHash}:${input.jobNonce ?? ""}`).slice(2);
  const reportData = ("0x" + bindInner + "00".repeat(32)) as `0x${string}`;

  const body: SimQuoteBody = {
    mrEnclave,
    mrSigner,
    isvProdId: 1,
    isvSvn: input.isvSvn ?? 1,
    reportData,
  };

  const sig = createHmac("sha256", simSecret()).update(canonical(header, body)).digest("hex");
  const signature = ("0x" + sig) as `0x${string}`;

  return {
    kind: "sim-sgx-quote",
    header,
    body,
    signature,
    generatedAt: new Date().toISOString(),
    disclosure: DISCLOSURE,
  };
}

/**
 * Verify a simulated quote against optional expected measurements. Returns
 * `mode: "sim"` always — callers must treat a "sim" quote as DEVELOPMENT
 * EVIDENCE ONLY, never as a production-grade attestation.
 */
export function verifySimulatedQuote(
  q: SimulatedQuote,
  expected?: SimVerifyExpected
): SimVerifyResult {
  const reasons: string[] = [];

  if (q.kind !== "sim-sgx-quote") reasons.push("not a sim-sgx-quote");
  if (q.header?.teeType !== "SGX-SIM") reasons.push("header.teeType is not SGX-SIM");
  if (q.header?.version !== 1) reasons.push("unsupported sim quote version");

  // Signature check — proves the quote was generated by a process that holds
  // the sim secret. NOT a hardware-rooted proof.
  const expectedSig = createHmac("sha256", simSecret())
    .update(canonical(q.header, q.body))
    .digest("hex");
  if (q.signature !== ("0x" + expectedSig)) reasons.push("signature mismatch");

  if (expected?.expectedMrEnclave && q.body.mrEnclave !== expected.expectedMrEnclave) {
    reasons.push("mrEnclave does not match expected");
  }
  if (expected?.expectedMrSigner && q.body.mrSigner !== expected.expectedMrSigner) {
    reasons.push("mrSigner does not match expected");
  }
  if (
    expected?.minSecurityVersion !== undefined &&
    q.body.isvSvn < expected.minSecurityVersion
  ) {
    reasons.push(`isvSvn ${q.body.isvSvn} < minSecurityVersion ${expected.minSecurityVersion}`);
  }

  return { ok: reasons.length === 0, mode: "sim", reasons };
}

export const SIM_DISCLOSURE = DISCLOSURE;
