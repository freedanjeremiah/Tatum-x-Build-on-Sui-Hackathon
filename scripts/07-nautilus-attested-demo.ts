// End-to-end attested-compute demo. Drives the real Nitro enclave path and prints
// the on-chain verification tx — the WOW evidence. Never fakes a result: if the
// enclave env is not configured it exits with a clear message.
import { callEnclave, ENCLAVE_URL_ENV } from "../lib/enclaveClient";
import { makeClientsFromKey } from "../lib/clients";
import { RegistryClient } from "../lib/registry";

async function main() {
  if (!process.env[ENCLAVE_URL_ENV]) {
    console.error(`[demo] ${ENCLAVE_URL_ENV} not set. Set it to the running Nitro enclave host.`);
    process.exit(1);
  }
  const datasetIpId = (process.env.DEMO_DATASET_ID ?? "0x0") as `0x${string}`;
  const algoHash = "sha256:mean-aggregate";
  console.log("=== 1. Call enclave process_data ===");
  const signed = await callEnclave({ datasetIpId, algoHash });
  console.log("enclave metrics:", signed.metrics);
  console.log("enclave sig (hex):", "0x" + Buffer.from(signed.signature).toString("hex"));

  console.log("\n=== 2. Verify on-chain via register_derivative_attested ===");
  const clients = await makeClientsFromKey(process.env.WALLET_PRIVATE_KEY!);
  const rc = new RegistryClient(clients.client);
  const tx = await rc.registerDerivativeAttested({
    tier: "public",
    parentId: datasetIpId,
    enclaveObjectId: process.env.REEF_ENCLAVE_OBJECT_ID!,
    timestampMs: signed.timestampMs,
    algoHash,
    metrics: signed.metricsBytes,
    signature: signed.signature,
  }, clients.signer as never);
  console.log("on-chain verify tx:", tx);
  console.log("\n=== Done — Sui Move verified the enclave. ===");
}
main().catch((e) => { console.error(e); process.exit(1); });
