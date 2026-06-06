// Live confidential-compute demo surface for the Playwright recording.
// A button triggers the REAL flow: callEnclave (Seal-decrypt + mean-aggregate
// inside the Nitro enclave) → register_derivative_attested (real on-chain
// signature, verified by Move). Renders the live metrics + tx digest.
//
// Run:  node --env-file=.env.demo --import tsx scripts/demo/live-demo-server.ts
// (env: ENCLAVE_PROCESS_URL=tunnel, DEMO_DATASET_ID/_CID/_ALLOWED_ALGOS, WALLET_PRIVATE_KEY,
//  TATUM blanked so the signing client uses the public fullnode — Tatum lacks getLatestSuiSystemState.)
import { createServer } from "node:http";
import { callEnclave } from "../../lib/enclaveClient";
import { makeClientsFromKey } from "../../lib/clients";
import { RegistryClient } from "../../lib/registry";

const PORT = Number(process.env.DEMO_PORT ?? 8099);
const DATASET = (process.env.DEMO_DATASET_ID ?? "0x0") as `0x${string}`;
const ALGO = "sha256:mean-aggregate";
const CID = process.env.DEMO_DATASET_CID;
const ALLOWED = (process.env.DEMO_ALLOWED_ALGOS ?? ALGO).split(",").map((s) => s.trim()).filter(Boolean);
const EXPLORER = (d: string) => `https://suiscan.xyz/testnet/tx/${d}`;

async function runJob() {
  const dataset = CID ? { ipId: DATASET, tier: "compute", cid: CID, allowedAlgoHashes: ALLOWED } : undefined;
  const signed = await callEnclave({ datasetIpId: DATASET, algoHash: ALGO, dataset, allowedAlgoHashes: ALLOWED });
  const clients = await makeClientsFromKey(process.env.WALLET_PRIVATE_KEY!);
  const rc = new RegistryClient(clients.client);
  const tx = await rc.registerDerivativeAttested({
    tier: "public",
    parentId: DATASET,
    enclaveObjectId: process.env.REEF_ENCLAVE_OBJECT_ID!,
    timestampMs: signed.timestampMs,
    algoHash: ALGO,
    metrics: signed.metricsBytes,
    signature: signed.signature,
  }, clients.signer as never);
  return { metrics: signed.metrics, tx, sig: "0x" + Buffer.from(signed.signature).toString("hex").slice(0, 32) + "…" };
}

const PAGE = `<!doctype html><html><head><meta charset=utf8><title>Reef · confidential compute</title></head>
<body style="margin:0;background:#07151c;color:#eaf6f4;font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif">
<div style="padding:44px 56px;max-width:1100px">
  <div style="font-size:30px;font-weight:800">Reef — confidential compute, live</div>
  <div style="font-size:15px;opacity:.8;margin:8px 0 28px">
    Click run: the worker <b>Seal-decrypts a private dataset inside an AWS Nitro enclave</b>, computes
    <code>mean-aggregate</code> over it, signs the result, and <b>Sui Move verifies the enclave on-chain</b>.</div>
  <button id=run style="font-size:17px;font-weight:700;padding:14px 26px;border:0;border-radius:12px;
    background:#2bd1c4;color:#06222a;cursor:pointer">▶ Run confidential compute job</button>
  <div id=stage style="margin-top:26px;font-size:15px;min-height:24px;opacity:.9"></div>
  <div id=out style="margin-top:18px;display:none">
    <table style="border-collapse:collapse;font-size:14px;background:#0c2230;border-radius:12px;overflow:hidden">
      <tr><td style="padding:10px 18px;color:#7fe3d8">dataset (Seal+Walrus)</td><td id=ds style="padding:10px 18px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;word-break:break-all"></td></tr>
      <tr><td style="padding:10px 18px;color:#7fe3d8">computed inside enclave</td><td id=mx style="padding:10px 18px;font-family:ui-monospace,Consolas,monospace"></td></tr>
      <tr><td style="padding:10px 18px;color:#7fe3d8">enclave signature</td><td id=sg style="padding:10px 18px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px"></td></tr>
      <tr><td style="padding:10px 18px;color:#7fe3d8">register_derivative_attested ✓</td><td id=tx style="padding:10px 18px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;word-break:break-all;color:#2bd1c4"></td></tr>
    </table>
    <div style="margin-top:16px;font-size:15px;opacity:.9">Sui Move accepted the result <b>only because the enclave signature verified on-chain.</b> Not a simulation.</div>
  </div>
</div>
<script>
  document.getElementById('run').onclick = async () => {
    const stage = document.getElementById('stage'), out = document.getElementById('out');
    document.getElementById('run').disabled = true;
    const steps = [
      'Seal-decrypting the private dataset inside the AWS Nitro enclave…',
      'Running mean-aggregate over the plaintext (inside the TEE)…',
      'Enclave signing the result with its attested ephemeral key…',
      'Submitting register_derivative_attested — Sui Move verifying on-chain…',
    ];
    const t0 = Date.now();
    let k = 0;
    const tick = setInterval(() => {
      const s = ((Date.now()-t0)/1000).toFixed(0);
      if (Date.now()-t0 > (k+1)*9000 && k < steps.length-1) k++;
      stage.innerHTML = '⏳ ' + steps[k] + ' <span style="opacity:.6">(' + s + 's)</span>';
    }, 500);
    try {
      const r = await fetch('/run', { method: 'POST' });
      const j = await r.json();
      clearInterval(tick);
      if (j.error) { stage.textContent = '✗ ' + j.error; return; }
      document.getElementById('ds').textContent = ${JSON.stringify(DATASET)};
      document.getElementById('mx').textContent = JSON.stringify(j.metrics);
      document.getElementById('sg').textContent = j.sig;
      document.getElementById('tx').textContent = j.tx;
      stage.textContent = '✓ verified on-chain';
      out.style.display = 'block';
    } catch (e) { clearInterval(tick); stage.textContent = '✗ ' + e.message; }
  };
</script></body></html>`;

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/run") {
    try {
      const r = await runJob();
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(r));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end(PAGE);
}).listen(PORT, "127.0.0.1", () => console.log(`live-demo on http://127.0.0.1:${PORT} (dataset ${DATASET}, explorer ${EXPLORER("<tx>")})`));
