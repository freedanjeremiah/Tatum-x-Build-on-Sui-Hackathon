// Copyright (c), Reef.
// SPDX-License-Identifier: Apache-2.0
//
// Reef confidential-compute Nautilus app.
//
// `process_data`:
//   1. parses { datasetIpId, algoHash, params } from the client (lib/enclaveClient.ts),
//   2. POSTs the job to the in-enclave TS worker at http://127.0.0.1:$WORKER_PORT/run
//      (worker/enclave-server.ts -> runComputeJob), receives { status, metrics },
//   3. builds ComputeResultPayload { dataset_id, algo_hash, metrics } — FIELD ORDER
//      matching `reef::reef::ComputeResultPayload` in move/sources/reef.move,
//   4. signs create_intent_message(intent=0 /*COMPUTE_RESULT_INTENT*/, timestamp_ms,
//      payload) with the enclave ephemeral key (BCS of IntentMessage, intent scope 0),
//   5. returns { response: { intent, timestamp_ms, data: { metrics, metrics_b64 } },
//      signature } where metrics_b64 = base64 of the EXACT bytes signed as `metrics`.
//
// CRITICAL byte-exact invariant (nautilus/RUNBOOK.md): the bytes signed as `metrics`
// MUST equal the bytes forwarded on-chain. We capture the exact serialized metrics
// bytes ONCE, sign them, and base64 the SAME buffer into `metrics_b64`. No re-encode.

use crate::common::IntentMessage;
use crate::AppState;
use crate::EnclaveError;
use axum::extract::State;
use axum::Json;
use fastcrypto::encoding::{Base64, Encoding, Hex};
use fastcrypto::traits::Signer;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

/// Intent scope for compute results. MUST equal `COMPUTE_RESULT_INTENT` (= 0) in reef.move.
const COMPUTE_RESULT_INTENT: u8 = 0;

/// The BCS payload the enclave signs. Field ORDER + types MUST mirror the Move
/// struct `reef::reef::ComputeResultPayload { dataset_id, algo_hash, metrics }`
/// (each a `vector<u8>` -> ULEB128 length-prefixed bytes under BCS).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComputeResultPayload {
    pub dataset_id: Vec<u8>,
    pub algo_hash: Vec<u8>,
    pub metrics: Vec<u8>,
}

/// Request body posted by lib/enclaveClient.ts to POST /process_data. The job is
/// sent un-wrapped (NOT inside a { payload } envelope), so deserialize it directly.
#[derive(Debug, Deserialize)]
pub struct ReefRequest {
    #[serde(rename = "datasetIpId")]
    pub dataset_ip_id: String,
    #[serde(rename = "algoHash")]
    pub algo_hash: String,
    #[serde(default)]
    pub params: Option<Value>,
}

/// Decode a Sui object id hex string into its raw 32 bytes, matching what
/// `object::id_to_bytes(parent)` yields on-chain. Short forms like "0x0" are
/// left-zero-padded to 32 bytes (a big-endian 32-byte object id).
fn object_id_to_32_bytes(s: &str) -> Result<Vec<u8>, EnclaveError> {
    let h = s.trim().trim_start_matches("0x").trim_start_matches("0X");
    if h.len() > 64 {
        return Err(EnclaveError::GenericError(format!(
            "datasetIpId hex too long for a 32-byte object id: {s}"
        )));
    }
    // Left-pad with zeros to exactly 64 hex chars (32 bytes, big-endian).
    let padded = format!("{h:0>64}");
    Hex::decode(&padded)
        .map_err(|e| EnclaveError::GenericError(format!("invalid datasetIpId hex {s}: {e}")))
}

pub async fn process_data(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ReefRequest>,
) -> Result<Json<Value>, EnclaveError> {
    // (1) Forward the job to the in-enclave TS worker over loopback.
    let worker_port = std::env::var("WORKER_PORT").unwrap_or_else(|_| "7070".to_string());
    let worker_url = format!("http://127.0.0.1:{worker_port}/run");
    let body = json!({
        "datasetIpId": req.dataset_ip_id,
        "algoHash": req.algo_hash,
        "params": req.params,
    });
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| EnclaveError::GenericError(format!("http client: {e}")))?;
    let resp = client
        .post(&worker_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("worker /run unreachable: {e}")))?;
    let worker_json: Value = resp
        .json()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("worker /run bad json: {e}")))?;

    // The metrics object the worker computed (numeric aggregates only; {} on
    // rejected/failed jobs). This is the value we surface AND the basis for the
    // exact signed bytes.
    let metrics_value = worker_json
        .get("metrics")
        .cloned()
        .unwrap_or_else(|| json!({}));

    // (2) The EXACT bytes we sign as the `metrics` field. Serialize ONCE, sign
    // these bytes, and base64 the SAME buffer — guaranteeing metrics_b64 decodes
    // back to byte-identical input (the RUNBOOK invariant; mismatch -> EBadEnclaveSig).
    let metrics_bytes = serde_json::to_vec(&metrics_value)
        .map_err(|e| EnclaveError::GenericError(format!("metrics serialize: {e}")))?;
    let metrics_b64 = Base64::encode(&metrics_bytes);

    // (3) Assemble ComputeResultPayload { dataset_id, algo_hash, metrics }.
    let dataset_id = object_id_to_32_bytes(&req.dataset_ip_id)?;
    let algo_hash_bytes = req.algo_hash.as_bytes().to_vec();
    let payload = ComputeResultPayload {
        dataset_id,
        algo_hash: algo_hash_bytes,
        metrics: metrics_bytes,
    };

    // (4) Sign BCS(IntentMessage{ intent: 0, timestamp_ms, data: payload }) with the
    // enclave ephemeral key — byte-for-byte what reef::enclave::verify_signature
    // reconstructs on-chain.
    let timestamp_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("clock: {e}")))?
        .as_millis() as u64;
    let intent_msg = IntentMessage::new(payload, timestamp_ms, COMPUTE_RESULT_INTENT);
    let signing_payload = bcs::to_bytes(&intent_msg)
        .map_err(|e| EnclaveError::GenericError(format!("bcs: {e}")))?;
    let signature = state.eph_kp.sign(&signing_payload);

    // (5) Respond in the exact shape lib/enclaveClient.ts expects. `data.metrics_b64`
    // is REQUIRED (the server fails closed without it).
    let status = worker_json
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    Ok(Json(json!({
        "response": {
            "intent": COMPUTE_RESULT_INTENT,
            "timestamp_ms": timestamp_ms,
            "data": {
                "metrics": metrics_value,
                "metrics_b64": metrics_b64,
                "status": status,
            }
        },
        "signature": Hex::encode(signature),
    })))
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_object_id_padding() {
        // "0x0" -> 32 zero bytes (what id_to_bytes(0x0) yields on-chain).
        let z = object_id_to_32_bytes("0x0").unwrap();
        assert_eq!(z, vec![0u8; 32]);
        // A full 32-byte id round-trips unchanged.
        let id = "0x7c6d094aaefc9ed68df43a9da6205ec9ab6c2433af3729cf7efb56de1b3d0c7a";
        let b = object_id_to_32_bytes(id).unwrap();
        assert_eq!(b.len(), 32);
        assert_eq!(Hex::encode(&b), &id[2..]);
    }

    #[test]
    fn test_metrics_b64_roundtrip() {
        // The bytes we base64 MUST decode back identically (no re-encode drift).
        let metrics = json!({"mean_0": 12.5, "count": 4});
        let bytes = serde_json::to_vec(&metrics).unwrap();
        let b64 = Base64::encode(&bytes);
        let decoded = Base64::decode(&b64).unwrap();
        assert_eq!(decoded, bytes);
    }

    #[test]
    fn test_matches_move_attest_vector() {
        // Cross-language proof: reproduce the EXACT signature from
        // move/tests/attest_tests.move (seed = 0x07 * 32). If this passes, the
        // bytes this enclave signs are byte-identical to what
        // reef::enclave::verify_signature reconstructs on-chain.
        use fastcrypto::ed25519::{Ed25519KeyPair, Ed25519PrivateKey};
        use fastcrypto::traits::{KeyPair, ToFromBytes};

        let sk = Ed25519PrivateKey::from_bytes(&[7u8; 32]).unwrap();
        let kp: Ed25519KeyPair = sk.into();
        // public key must equal the Move test's PK
        assert_eq!(
            Hex::encode(kp.public().as_bytes()),
            "ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22c"
        );

        let payload = ComputeResultPayload {
            dataset_id: vec![0xabu8; 32],
            algo_hash: b"sha256:mean-aggregate".to_vec(),
            metrics: br#"{"columnMeans_0":3,"n":5}"#.to_vec(),
        };
        let intent_msg = IntentMessage::new(payload, 1717000000000u64, COMPUTE_RESULT_INTENT);
        let signing_payload = bcs::to_bytes(&intent_msg).unwrap();
        let sig = kp.sign(&signing_payload);
        assert_eq!(
            Hex::encode(sig),
            "f61fe37b348003251ddbec8c0d2b45deb6d18ae461ac49eeed23b532812215dc07519492904ed439553b04f8944ebf410ff2c5cd79150b6b250488c38bfc9403"
        );
    }

    #[test]
    fn test_payload_bcs_field_order() {
        // dataset_id (32) ++ algo_hash ++ metrics, each ULEB128 length-prefixed.
        let payload = ComputeResultPayload {
            dataset_id: vec![0u8; 32],
            algo_hash: b"sha256:mean-aggregate".to_vec(),
            metrics: b"{}".to_vec(),
        };
        let b = bcs::to_bytes(&payload).unwrap();
        // first byte is the ULEB128 length of dataset_id = 32 = 0x20
        assert_eq!(b[0], 0x20);
        assert_eq!(&b[1..33], &[0u8; 32]);
        // then algo_hash length = 21 (0x15)
        assert_eq!(b[33], 21u8);
    }
}
