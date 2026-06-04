/**
 * gen-attest-vectors.mjs
 *
 * Generates deterministic ed25519 test vectors for reef::registry::register_derivative_attested.
 *
 * Signed bytes layout (BCS of IntentMessage<ComputeResultPayload>):
 *   intent     : u8
 *   timestamp_ms: u64 (little-endian)
 *   payload    : ComputeResultPayload (BCS)
 *     dataset_id : vector<u8>  (length-prefixed)
 *     algo_hash  : vector<u8>  (length-prefixed)
 *     metrics    : vector<u8>  (length-prefixed)
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { bcs } from "@mysten/bcs";

// ---- deterministic keypair ----
const seed = new Uint8Array(32).fill(7);
const kp = Ed25519Keypair.fromSecretKey(seed);
const pk = kp.getPublicKey().toRawBytes(); // 32 bytes

// ---- fixed inputs ----
const datasetId   = new Uint8Array(32).fill(0xab);              // 32 bytes of 0xab
const algoHash    = new TextEncoder().encode("sha256:mean-aggregate");
const metricsJson = JSON.stringify({ columnMeans_0: 3, n: 5 });
const metrics     = new TextEncoder().encode(metricsJson);
const timestampMs = 1717000000000n;                              // BigInt for u64
const INTENT      = 0;

// ---- BCS schema (mirrors IntentMessage<ComputeResultPayload> in enclave.move) ----
const Payload = bcs.struct("ComputeResultPayload", {
  dataset_id: bcs.vector(bcs.u8()),
  algo_hash:  bcs.vector(bcs.u8()),
  metrics:    bcs.vector(bcs.u8()),
});

const IntentMsg = bcs.struct("IntentMessage", {
  intent:       bcs.u8(),
  timestamp_ms: bcs.u64(),
  payload:      Payload,
});

// ---- serialise ----
const msg = IntentMsg.serialize({
  intent:       INTENT,
  timestamp_ms: timestampMs,
  payload: {
    dataset_id: [...datasetId],
    algo_hash:  [...algoHash],
    metrics:    [...metrics],
  },
}).toBytes();

// ---- sign RAW (not signPersonalMessage) ----
const signature = await kp.sign(msg); // Promise<Uint8Array>, 64 raw bytes

// ---- helpers ----
const hex = (bytes) => Buffer.from(bytes).toString("hex");

// ---- output ----
console.log("=== Attest Vectors ===");
console.log("pk            :", hex(pk));
console.log("dataset_id    :", hex(datasetId));
console.log("algo_hash     :", hex(algoHash));
console.log("algo_hash_utf8:", new TextDecoder().decode(algoHash));
console.log("metrics       :", hex(metrics));
console.log("metrics_utf8  :", new TextDecoder().decode(metrics));
console.log("timestamp_ms  :", timestampMs.toString());
console.log("msg_hex       :", hex(msg));
console.log("msg_len       :", msg.length);
console.log("sig           :", hex(signature));
console.log("sig_len       :", signature.length);
