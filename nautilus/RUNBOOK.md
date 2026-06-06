# Phase 4 Runbook — Nitro enclave + Nautilus on-chain registration

> **Status: NOT executed/verified on the dev box.** Phases 1–3 (on-chain
> verification + the full TS server path) are implemented and tested. This phase
> requires an AWS Nitro-enabled EC2 instance and must be run there. Each step is
> an operational command; the *verifier* it feeds is already proven by
> `move/tests/attest_tests.move`.

Corresponds to plan Tasks 12 and 14 in
`docs/superpowers/plans/2026-06-05-reef-nautilus-tee.md`.

## Prereqs (on the EC2 instance)
- Nitro-enabled instance (e.g. `m5.xlarge`) with the enclave option enabled.
- `nitro-cli`, Docker, Rust toolchain, Node 20+, the Sui CLI, AWS CLI.
- This repo checked out; `pnpm install` done.

---

## ⚠️ CRITICAL integration invariant — byte-exact payload

`reef::registry::register_derivative_attested` reconstructs the signed payload as
`ComputeResultPayload { dataset_id, algo_hash, metrics }` and verifies the enclave
signature over `BCS(IntentMessage{ intent: 0, timestamp_ms, payload })` where the
on-wire layout is `intent(u8) ++ timestamp_ms(u64 LE) ++ bcs(payload)` and each
`vector<u8>` is ULEB128 length-prefixed (proven in `move/tests/attest_tests.move`).

For verification to pass, **the exact bytes the enclave signs must equal the exact
bytes the server forwards on-chain**:

| Field | Bytes that MUST match |
|-------|------------------------|
| `dataset_id` | the raw 32 bytes of the dataset's Sui object id (what `object::id_to_bytes(parent)` yields on-chain). The server passes `parentId = datasetIpId`; the enclave must sign those same 32 bytes. |
| `algo_hash` | UTF-8 of the algo string (e.g. `"sha256:mean-aggregate"`). `lib/registry.ts` encodes `new TextEncoder().encode(args.algoHash)`. |
| `metrics` | **the byte-for-byte metrics blob.** This is the footgun. |

### The metrics footgun — **DONE on the TS side**

`lib/enclaveClient.ts` now exposes `metricsBytes: Uint8Array` — the EXACT signed
bytes decoded from `data.metrics_b64` in the enclave response. `callEnclave`
**throws** (fail-closed) if `metrics_b64` is absent — no silent re-encode.
`app/api/compute/route.ts` and `scripts/07-nautilus-attested-demo.ts` forward
`signed.metricsBytes` verbatim to `registerDerivativeAttested` (no re-`JSON.stringify`).

**Remaining enclave-side requirement (Task 12 Step 2):** the Rust `process_data`
MUST return `data.metrics_b64` = base64 of the EXACT bytes it signed as the
`metrics` field of `ComputeResultPayload`. The TS server now forwards those bytes
unchanged. As long as the Rust side includes `metrics_b64` in the response and the
on-chain `metrics` argument matches the signed bytes, `verify_signature` will pass.

---

## Task 12 — Scaffold the Nautilus enclave app calling the TS worker

1. **Clone the template into `nautilus/`:**
   ```bash
   git clone https://github.com/MystenLabs/nautilus tmp-nautilus
   cp -r tmp-nautilus/src nautilus/src
   cp tmp-nautilus/Makefile nautilus/ 2>/dev/null || true
   cp tmp-nautilus/*.sh nautilus/ 2>/dev/null || true
   rm -rf tmp-nautilus
   ```
   Read the upstream `UsingNautilus.md` for the exact template layout/targets.

2. **Implement `process_data`** (Rust) to:
   - parse `{ datasetIpId, algoHash, params }`,
   - POST to the in-enclave TS worker at `http://127.0.0.1:$WORKER_PORT/run`
     (the listener from `worker/enclave-server.ts`), receive `{ status, metrics }`,
   - build `ComputeResultPayload { dataset_id = 32 raw bytes of datasetIpId,
     algo_hash = utf8(algoHash), metrics = <canonical bytes — see invariant above> }`,
   - sign `create_intent_message(0 /*COMPUTE_RESULT_INTENT*/, timestamp_ms, payload)`
     with the ephemeral key (Nautilus stock signing),
   - return `{ response: { intent: 0, timestamp_ms, data: { metrics, metrics_b64 } },
     signature }`. Include `metrics_b64` (the exact signed metrics bytes) so the
     server can forward them verbatim (fix #1 above).
   - The `ComputeResultPayload` BCS struct in Rust MUST mirror the Move struct
     field order exactly: `dataset_id`, `algo_hash`, `metrics`.

3. **Bundle the TS worker into the EIF.** Multi-stage Docker → EIF containing Node +
   the repo's `worker/enclave-server.ts` (run it with `WORKER_PORT` set) alongside
   the Rust app. Configure the Nautilus HTTPS forwarding/proxy to allow the
   enclave's outbound HTTPS to the **Seal key servers** and the **Walrus aggregator**
   (the worker needs both to Seal-decrypt and read the ciphertext blob).

4. **Reproducible build + capture PCRs:**
   ```bash
   cd nautilus && make            # or the template's EIF build target
   nitro-cli describe-eif --eif-path <built>.eif   # record PCR0/PCR1/PCR2
   ```
   Commit `nautilus/` source (NOT the EIF):
   ```bash
   git add nautilus && git commit -m "feat(nautilus): Rust enclave app forwarding to in-enclave TS worker"
   ```

---

## Task 14 — Publish + register the enclave on-chain

1. **Publish the Move package** (includes the vendored `reef::enclave` + `reef::registry`):
   ```bash
   cd move && sui client publish --gas-budget 200000000
   ```
   Record the package id → set `REEF_PACKAGE_ID` (and `NEXT_PUBLIC_OV_REEF_PACKAGE_ID`).

2. **Create the EnclaveConfig + register PCRs** using Nautilus tooling / PTBs:
   - `reef::enclave::new_cap<REEF>(REEF {})` → `Cap<REEF>`
   - `reef::enclave::create_enclave_config<REEF>(cap, "reef-compute", pcr0, pcr1, pcr2)`
     with the Task 12 PCRs.

3. **Register the running enclave's attestation:**
   ```bash
   cd nautilus && ./register_enclave.sh   # fetches get_attestation, submits the document on-chain
   ```
   Record the created `Enclave<REEF>` object id → set `REEF_ENCLAVE_OBJECT_ID`.

4. **Probe end-to-end:**
   ```bash
   WORKER_ISOLATION_MODE=enclave-nautilus \
   ENCLAVE_PROCESS_URL=https://<enclave-host> \
   REEF_ENCLAVE_OBJECT_ID=0x… \
   WALLET_PRIVATE_KEY=0x… \
   DEMO_DATASET_ID=0x<compute-tier-dataset> \
   pnpm exec tsx scripts/07-nautilus-attested-demo.ts
   ```
   Expected: prints the enclave-signed payload + the `register_derivative_attested`
   tx digest (the on-chain verify). If it aborts with `EBadEnclaveSig`, the metrics
   byte-match invariant above is violated — apply fix #1 and retry.

---

## Honest fallback if the clock runs out
Phases 1–3 already deliver: the Move contract verifies enclave attestations
on-chain (tested), and the full server path is wired fail-closed. If the live
enclave isn't stood up in time, keep `WORKER_ISOLATION_MODE=enclave-sim` (honestly
disclosed, no silent fallback) and demo the on-chain verifier via the passing
`sui move test attest`. Never claim an enclave that did not run.
