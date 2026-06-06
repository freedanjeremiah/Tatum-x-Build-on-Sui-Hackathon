// Create a REAL compute-tier dataset over small numeric CSV data:
//  - register(tier=compute) -> ArtifactRegistry (the dataset id)
//  - Seal-encrypt bound to (artifactId, "compute") + publish ciphertext to Walrus
//  - add the worker operator (master wallet) to the on-chain compute_workers allowlist
// Prints DEMO_DATASET_ID + cid (Walrus blobId) + the allowlist tx.
import { getClients, logTx } from "../_util";
import { uploadCompute, type Clients } from "../../lib/artifacts";
import { RegistryClient } from "../../lib/registry";

const ALLOWED = ["sha256:mean-aggregate"];
const CSV = "a,b,c\n1,2,3\n4,5,6\n7,8,9"; // mean-aggregate -> {columnMeans_0:4,_1:5,_2:6,n:3}

async function main() {
  const clients = await getClients();
  const owner = (clients.account as { address: string }).address as `0x${string}`;
  console.log("owner / worker operator:", owner);

  const dataset = await uploadCompute(clients as unknown as Clients, {
    bytes: new TextEncoder().encode(CSV),
    meta: {
      title: "Compute Numeric CSV (a,b,c)",
      description: "Compute-tier dataset; raw rows decrypted ONLY inside the enclave.",
      tags: ["dataset", "compute", "nautilus"],
      creators: [{ name: "Reef Demo", address: owner, contributionPercent: 100 }],
      modality: "dataset",
    },
    terms: { rev: 5, fee: 1n },
    allowedAlgoHashes: ALLOWED,
  });
  logTx("register+encrypt+store compute dataset", dataset.createdTx);
  console.log("DEMO_DATASET_ID:", dataset.ipId);
  console.log("cid (Walrus blobId):", dataset.cid);
  console.log("allowedAlgoHashes:", dataset.allowedAlgoHashes);

  // Put the worker operator on the on-chain compute_workers allowlist so Seal's
  // seal_approve admits the compute branch (the enclave decrypts as this address).
  const rc = new RegistryClient(clients.client);
  const tx = await rc.addComputeWorker(dataset.capId!, dataset.ipId, owner, clients.signer as never);
  logTx("add_compute_worker(owner)", tx);
  console.log("\nDONE. DEMO_DATASET_ID =", dataset.ipId);
}
main().catch((e) => { console.error("FAILED:", (e as Error).message); process.exit(1); });
