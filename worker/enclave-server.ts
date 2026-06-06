// worker/enclave-server.ts — runs INSIDE the enclave only. Exposes the existing
// runComputeJob over localhost so the Nautilus Rust shim can call it. Metrics only.
import { createServer } from "node:http";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { runComputeJob } from "./compute-worker";

// The enclave has no direct internet route. When ENCLAVE_HTTPS_PROXY is set, route
// ALL outbound fetch (Sui fullnode, Seal key servers, Walrus aggregator) through a
// host CONNECT proxy reached over vsock — the host resolves DNS + dials out. This
// makes Seal-decrypt + Walrus reads work from inside the enclave.
const PROXY = process.env.ENCLAVE_HTTPS_PROXY;
if (PROXY) {
  setGlobalDispatcher(new ProxyAgent(PROXY));
  console.log(`[worker] routing outbound HTTPS via CONNECT proxy ${PROXY}`);
}

const PORT = Number(process.env.WORKER_PORT ?? 7070);
createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.endsWith("/run")) { res.statusCode = 404; return res.end(); }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      const { datasetIpId, algoHash, params, dataset, allowedAlgoHashes } = JSON.parse(body);
      const r = await runComputeJob({ datasetIpId, algoHash, params, dataset, allowedAlgoHashes });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ status: r.status, metrics: r.metrics ?? {}, reason: r.reason }));
    } catch (e) {
      res.statusCode = 500; res.end(JSON.stringify({ status: "failed", reason: (e as Error).message }));
    }
  });
}).listen(PORT, "127.0.0.1");
