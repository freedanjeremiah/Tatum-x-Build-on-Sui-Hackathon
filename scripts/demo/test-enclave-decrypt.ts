// Pre-flight: exercise the exact in-enclave worker path (Seal-decrypt + Walrus
// read + mean-aggregate) but on the host, routing ALL outbound HTTPS through the
// CONNECT proxy (ENCLAVE_HTTPS_PROXY) to validate the proxy egress design before
// baking it into the EIF. Prints the real metrics.
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { runComputeJob } from "../../worker/compute-worker";

const PROXY = process.env.ENCLAVE_HTTPS_PROXY;
if (PROXY) { setGlobalDispatcher(new ProxyAgent(PROXY)); console.log("via proxy:", PROXY); }

async function main() {
  const datasetIpId = process.env.DEMO_DATASET_ID as `0x${string}`;
  const cid = process.env.DEMO_DATASET_CID!;
  const allowedAlgoHashes = (process.env.DEMO_ALLOWED_ALGOS ?? "sha256:mean-aggregate").split(",");
  const r = await runComputeJob({
    datasetIpId,
    algoHash: "sha256:mean-aggregate",
    dataset: { ipId: datasetIpId, tier: "compute", cid, allowedAlgoHashes } as never,
    allowedAlgoHashes,
  });
  console.log("status:", r.status);
  console.log("metrics:", r.metrics);
  console.log("reason:", r.reason);
  console.log("isolationMode:", r.isolationMode);
}
main().catch((e) => { console.error("FAILED:", (e as Error).message); process.exit(1); });
