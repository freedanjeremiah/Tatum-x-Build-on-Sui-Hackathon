# Reef × Nautilus — real TEE confidential compute, verified on-chain

**Date:** 2026-06-05
**Status:** Design approved (Fork A), pending spec review
**Deadline context:** Tatum × Walrus hackathon submission 2026-06-06 17:00 UTC.

## Problem

Reef's confidential-compute worker today runs on a plain server. Its only "proof"
of isolation is a TEE simulator (`lib/tee-sim.ts`) that signs a structurally-SGX-
shaped quote with an **HMAC over a server-side secret** — honestly disclosed as
NOT hardware-attested. A hackathon judge can read this as "they didn't do the hard
part": the privacy guarantee is asserted, not enforced.

This design replaces the assertion with a real, on-chain-verifiable guarantee by
running the worker inside an **AWS Nitro Enclave** wrapped by **Nautilus** (Sui's
official verifiable-offchain-compute framework), and having Reef's own Move
contract verify the enclave attestation and the enclave-signed result before
accepting a compute derivative on-chain.

The guarantee changes from "trust the operator" to "Sui Move verified the
enclave." Same Nitro hardware the team already chose; Nautilus adds the on-chain
verification layer.

## Goals

- A compute derivative at the `compute` tier is accepted on-chain **only** when an
  enclave-signed result verifies against an on-chain-registered enclave (PCRs +
  ephemeral public key) via Nautilus's `enclave` Move module.
- The existing TypeScript worker (`worker/compute-worker.ts`) and its algorithms
  (`worker/algos/*`) run **unchanged in logic** — they execute inside the enclave,
  reached by a thin Rust shim. No port of algorithms to Rust.
- The TEE simulator remains as an **honestly-disclosed CI/dev fallback**. No silent
  fallback: if the real enclave path is selected but unavailable, the job fails
  loudly rather than degrading to plain-server while claiming otherwise.
- Preserve the backend conventions proven in the predecessor (CDR-hackathon) and
  current Reef code: `/api/compute` loads the dataset's public index record, checks
  tier + allowlist, delegates to the worker, self-indexes the result derivative,
  and surfaces non-fatal failures as warnings (the on-chain object stays the source
  of truth).

## Non-goals

- Mainnet deployment (testnet prototype; on-chain verification logic is identical).
- Porting `mean-aggregate` / `logistic-regression` to Rust.
- Hiding metadata (object ids, blob ids remain public by design).
- Multi-enclave committees / rotation beyond a single registered enclave instance.
- Replacing Seal: Seal still does threshold IBE + on-chain-gated key delivery. The
  enclave is the *compute* isolation boundary; Seal is the *key-delivery* gate. Both
  hold independently, as documented in the README honesty section.

## Decision: Fork A — thin Rust shim, TS worker inside the enclave

Nautilus signs results in Rust using BCS to match `enclave.move`. Two ways to keep
the TS worker:

- **A (chosen):** The stock Nautilus Rust app owns attestation, the ephemeral
  signing keypair, BCS serialization, and vsock/HTTP forwarding. Inside the *same*
  enclave it calls the existing TS worker over localhost for decrypt + algo, gets
  the metrics JSON back, and BCS-signs it. TS algorithms unchanged; Nautilus
  scaffolding unchanged.
- **B (rejected):** Node-native enclave — re-implement Nautilus's enclave-side
  primitives (NSM attestation via `/dev/nsm`, ephemeral key, BCS signing matching
  `enclave.move`) in TypeScript. Rebuilds the exact hard part Nautilus already
  solved; too risky before the deadline.

## Architecture

```
Consumer (browser) ──POST /api/compute──▶ Reef server (Next.js, nodejs runtime)
                                              │
                                              ▼ (vsock/HTTP via Nautilus proxy)
                                   ┌──────────────────────────────┐
                                   │  AWS Nitro Enclave            │
                                   │  ┌──────────────────────────┐ │
                                   │  │ Nautilus Rust shim        │ │
                                   │  │  • get_attestation (NSM)  │ │
                                   │  │  • ephemeral keypair      │ │
                                   │  │  • process_data endpoint  │ │
                                   │  └───────────┬──────────────┘ │
                                   │              │ localhost call  │
                                   │  ┌───────────▼──────────────┐ │
                                   │  │ TS worker (runComputeJob) │ │
                                   │  │  • Seal-gated decrypt     │ │
                                   │  │  • allowlisted algo       │ │
                                   │  │  • wipe plaintext         │ │
                                   │  │  • return metrics JSON    │ │
                                   │  └──────────────────────────┘ │
                                   └──────────────────────────────┘
                                              │ {response, signature}
                                              ▼
              Reef server ──register_derivative_attested(payload, sig, &Enclave)──▶ Sui
                                              │
                                   ┌──────────▼───────────┐
                                   │ reef::registry (Move)│
                                   │  enclave::verify_*   │  ← AWS root-of-trust in
                                   │  PCRs + ephem pubkey │    Sui framework; rejects
                                   │  then register parent│    bad sig / wrong PCRs
                                   └──────────────────────┘
```

## Components and changes

### New: `nautilus/` (Rust enclave app, from Nautilus template)
- Reproducible-build EIF, `register_enclave.sh`, vsock/HTTP forwarding — taken
  from the Nautilus template with minimal edits.
- `process_data` endpoint: accepts `{ datasetIpId, algoHash, params }`, calls the
  in-enclave TS worker over localhost, receives metrics JSON, then returns the
  Nautilus-standard `{ response: { intent, timestamp_ms, data }, signature }` where
  `data = { datasetIpId, algoHash, metrics }`, BCS-serialized and signed by the
  ephemeral key. `intent` is a fixed Reef constant (e.g. `INTENT_COMPUTE_RESULT`).
- The TS worker is launched inside the enclave as a localhost service (subprocess
  or small HTTP listener); plaintext never crosses the enclave boundary — only the
  signed metrics leave.

### Changed: `worker/compute-worker.ts`
- No change to the decrypt → allowlist → algo → wipe → metrics logic.
- Add an entry path (localhost service or stdin/stdout) so the Rust shim can invoke
  `runComputeJob` and read back the `ComputeJobResult` (metrics only).
- When `WORKER_ISOLATION_MODE=enclave-nautilus`, skip the sim-quote pre-step (the
  real attestation supersedes it). Keep the sim pre-step only under `enclave-sim`.

### New: `move/sources/enclave.move` (from Nautilus)
- Stock Nautilus module: `EnclaveConfig`, `EnclaveCap`, `Enclave`, `update_pcrs`,
  `register_enclave`, and AWS-attestation verification against the AWS root of trust
  bundled in the Sui framework. Deployed once; PCRs registered for our EIF; the
  enclave's ephemeral public key bound on-chain via `register_enclave.sh`.

### Changed: `move/sources/reef.move`
- New entry: `register_derivative_attested(tier, price, parent, group_id,
  enclave: &Enclave, timestamp_ms, payload_bytes, signature, ctx)`.
  - Calls `enclave::verify_signature` (Nautilus) on the BCS payload + signature
    against the registered enclave public key; aborts on mismatch.
  - Asserts the payload's `datasetIpId` equals `parent` and `algoHash` is sane.
  - On success, calls the existing `register_internal(..., some(parent))`.
- The compute path should prefer this attested entry. The plain
  `register_derivative` remains for non-compute lineage. (Enforcement that
  compute-tier results *must* be attested can be added on the consuming/index side
  for the prototype; a stricter Move-level guard is a stretch goal.)

### Changed: `lib/attestation.ts`
- `workerIsolation()` gains `"enclave-nautilus"`.
- `isolationDisclosure(...)` for that mode:
  "compute worker in AWS Nitro enclave — attestation verified on-chain (tx …)".
- `enclave-sim` and `plain-server` disclosures unchanged (still honest).

### Changed: `lib/registry.ts`
- `buildRegisterDerivativeAttestedTx({ parentIpId, payloadBytes, signature,
  enclaveObjectId, timestampMs, tier, price })` — builds the PTB calling
  `register_derivative_attested`.

### Changed: `types/artifact.ts`
- `AttestationInfo` gains optional `enclaveObjectId: 0x…`, `attestationTx: 0x…`,
  `enclaveSig: 0x…`. These travel with `ComputeJobResult` so the UI can show the
  on-chain verification.

### Changed: `app/api/compute/route.ts`
- Keep the proven shape: load dataset index record, check `tier === "compute"` +
  allowlist, delegate, self-index the derivative, surface warnings.
- When the result is `done` and produced an enclave signature, call
  `buildRegisterDerivativeAttestedTx` and execute it (server signer), recording
  `attestationTx` on the result. If the enclave path is configured but the enclave
  is unreachable, return `failed` (no silent fallback to plain-server).

### New: `scripts/07-nautilus-attested-demo.ts`
- Analog of CDR's `scripts/06-enclave-sim-demo.ts`. Drives the real enclave path,
  prints the enclave-signed payload, executes `register_derivative_attested`, and
  prints the on-chain verification tx — the demo's WOW evidence.

## Data flow (one compute job)

1. Consumer runs job → `POST /api/compute` → route loads dataset record, checks
   tier + allowlist.
2. Route forwards to the enclave's `process_data` (vsock/HTTP via Nautilus proxy).
3. Inside the enclave: Seal-gated decrypt (compute_workers allowlist, unchanged) →
   run allowlisted algo → metrics → wipe plaintext.
4. Rust shim BCS-signs `{ intent, timestamp_ms, { datasetIpId, algoHash, metrics } }`
   with the ephemeral key; returns `{ response, signature }`.
5. Route calls `register_derivative_attested`; `enclave.move` verifies the
   signature against the registered enclave pubkey and the registered PCRs; on
   success the derivative is registered with `parent = datasetIpId`.
6. Route self-indexes the derivative and returns metrics + `attestationTx`.
7. UI shows the verify tx via `TxLink`: "Sui Move verified the enclave."

## Error handling and invariants

- **Fail closed, no silent fallback.** `enclave-nautilus` selected but enclave
  unreachable → `failed`, never a plain-server run mislabeled as attested.
- **Plaintext never leaves the enclave** — only signed aggregate metrics.
- **Off-allowlist algorithm** → rejected before any decrypt (`decryptCalled:false`),
  unchanged.
- **Seal NoAccess** (worker not on `compute_workers`) → honest denial, unchanged.
- **On-chain verification is the gate**: a forged or wrong-PCR signature aborts in
  Move; the derivative is not created.
- **Index is a cache**: if self-indexing fails, the on-chain object is still the
  source of truth; surface a warning (CDR/Reef convention).

## Honest deadline ladder (each step is a shippable stop)

1. **Move-only:** deploy `enclave.move` + `register_derivative_attested`; register a
   real enclave's PCRs + pubkey once; verify a captured enclave signature on-chain.
   On-chain verification is real even before the live enclave is wired to the UI.
2. **+ Rust shim → TS worker** running in a real enclave (Fork A).
3. **+ live UI** end-to-end in the demo (`TxLink` to the verify tx).
4. **Sim stays** as the disclosed CI/dev fallback — no silent fallback.

If Nitro provisioning stalls, ship step 1 (the credibility win — Sui verifying the
TEE) and keep the simulator honestly disclosed for the rest. Never claim an enclave
that did not run.

## Testing

- **Move:** extend `move/tests/registry_tests.move` — `register_derivative_attested`
  accepts a valid signed payload and aborts on a bad signature / unregistered
  enclave / wrong PCRs.
- **TS:** `worker/compute-worker.test.ts` unchanged logic; add a test that the
  `enclave-nautilus` mode skips the sim pre-step and that a missing enclave endpoint
  yields `failed` (no plain-server mislabel).
- **Script:** `scripts/07-nautilus-attested-demo.ts` is the manual end-to-end proof.
- Existing honesty tests (`lib/tee-sim.test.ts`, allowlist gate) stay green.

## Risks

- **Nitro provisioning in <24h** is the dominant risk (Nitro-enabled EC2, EIF build,
  `nitro-cli`, vsock proxy). Mitigated by the deadline ladder: step 1 lands the
  on-chain verification independently of the live enclave.
- **BCS payload alignment** between the Rust shim and `enclave.move` (a known
  Nautilus footgun) — keep the signed struct minimal and mirror it exactly.
- **Enclave egress for Seal/Walrus**: the enclave needs outbound HTTPS to the Seal
  key servers and Walrus aggregator; the Nautilus template's HTTPS forwarding covers
  this but must be configured for those hosts.
