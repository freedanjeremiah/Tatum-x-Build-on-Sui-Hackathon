// Records a captioned demo video of Reef using Playwright (browser-only).
// Scenes: the live app (home + Tatum status) → the real Sui explorer verify tx →
// a styled on-chain evidence card (reliable closer). Video → e2e/shots/demo/*.webm
//
// Run from e2e/:  node record-demo.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const APP = process.env.APP_URL ?? "https://localhost:3000";
const TX = "926wJkXLbJoWNpoa5YBjSnVcxahztAu9svjWnww1mMco";          // register_derivative_attested (verified)
const ENCLAVE = "0x2bf98f2a6ea8e78835463e8dcece3d321eae948b527e699c69bca91a70c5b21e";
const PKG = "0x3203061e549b9df36a842a53fe3ef40e2a2e923e05a9aeed26ed9715ee63db7d";
const DATASET = "0xdcb43aeb3b2d6c14be413061826e1c6cd885c58e70b2f841ba15b9057d32f1fa";
const REGENC = "3m78crZ2ysQ83DKbQuimFh9aVVhVPkPF8NxX4NQyBbnS";       // register_enclave (AWS-root verified)
const OUT = "shots/demo";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Inject a caption banner (top) + brand footer. Self-narrating, no audio needed.
async function caption(page, title, sub) {
  await page.evaluate(
    ([title, sub]) => {
      let el = document.getElementById("__demo_cap");
      if (!el) {
        el = document.createElement("div");
        el.id = "__demo_cap";
        el.style.cssText =
          "position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:18px 28px;" +
          "background:linear-gradient(90deg,#0b1f2a,#0e3a4f);color:#fff;font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif;" +
          "box-shadow:0 4px 24px rgba(0,0,0,.35);border-bottom:2px solid #2bd1c4;";
        document.body.appendChild(el);
      }
      el.innerHTML =
        '<div style="font-size:22px;font-weight:700;letter-spacing:.2px">' + title + "</div>" +
        (sub ? '<div style="font-size:14px;opacity:.85;margin-top:4px">' + sub + "</div>" : "");
    },
    [title, sub ?? ""],
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  // ---- Scene 1: the app ----
  try {
    await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(1500);
    await caption(page, "Reef — a private data & model market on Sui", "Datasets encrypted with Seal, stored on Walrus, gated on-chain by Move");
    await sleep(4500);
    await page.mouse.wheel(0, 500);
    await sleep(2500);
    await page.mouse.wheel(0, 600);
    await sleep(2500);
  } catch (e) {
    console.warn("scene1 (app) skipped:", e.message);
  }

  // ---- Scene 2: Tatum status ----
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await caption(page, "RPC + gas + status routed through Tatum", "Live reference gas price via the Tatum Sui gateway (top of the header)");
    await sleep(5000);
  } catch (e) { console.warn("scene2 skipped:", e.message); }

  // ---- Scene 3: the confidential-compute pipeline (styled card, reliable) ----
  try {
    await page.setContent(pipelineHtml(), { waitUntil: "domcontentloaded" });
    await sleep(9000);
  } catch (e) { console.warn("scene3 (pipeline) skipped:", e.message); }

  // ---- Scene 4: reliable evidence card (always renders) ----
  try {
    await page.setContent(evidenceHtml(), { waitUntil: "domcontentloaded" });
    await sleep(9000);
  } catch (e) { console.warn("scene4 (card) skipped:", e.message); }

  await sleep(800);
  await ctx.close(); // finalizes the video
  await browser.close();

  // report the produced file
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".webm"));
  console.log("VIDEO_FILES=" + JSON.stringify(files.map((f) => `${OUT}/${f}`)));
}

function pipelineHtml() {
  const box = (t, s) => `<div style="background:#0c2230;border:1px solid #1c3b4a;border-radius:12px;padding:16px 18px;min-width:150px">
     <div style="font-weight:700;color:#2bd1c4;font-size:15px">${t}</div><div style="font-size:12.5px;opacity:.82;margin-top:5px;line-height:1.45">${s}</div></div>`;
  const arrow = `<div style="color:#2bd1c4;font-size:26px;align-self:center">→</div>`;
  return `<!doctype html><html><body style="margin:0;background:#07151c;color:#eaf6f4;font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif">
  <div style="padding:44px 56px">
    <div style="font-size:28px;font-weight:800">Confidential compute, verified on-chain</div>
    <div style="font-size:15px;opacity:.8;margin:8px 0 30px">"Computable, not downloadable" — enforced by a real TEE, not a promise.</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap">
      ${box("1 · Seal-gated decrypt", "Inside an AWS Nitro enclave, the worker decrypts the Walrus blob — only because the on-chain compute_workers allowlist admits it.")}
      ${arrow}
      ${box("2 · Compute in the TEE", "Runs an allowlisted algorithm (mean-aggregate) over the plaintext. Raw rows never leave the enclave.")}
      ${arrow}
      ${box("3 · Enclave signs", "Ephemeral enclave key signs IntentMessage{ dataset, algo, metrics }.")}
      ${arrow}
      ${box("4 · Sui Move verifies", "reef::registry::register_derivative_attested checks the AWS attestation + signature on-chain. Aborts unless it's a genuine enclave.")}
    </div>
    <div style="margin-top:30px;font-size:15px;opacity:.9">Guarantee: <b style="color:#2bd1c4">"Sui Move verified the enclave"</b> — not "trust the operator."</div>
  </div></body></html>`;
}

function evidenceHtml() {
  const row = (k, v) => `<tr><td style="padding:8px 16px;color:#7fe3d8;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:8px 16px;font-family:ui-monospace,Consolas,monospace;font-size:13px;word-break:break-all">${v}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#07151c;color:#eaf6f4;font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif">
  <div style="padding:40px 56px">
    <div style="font-size:30px;font-weight:800">Verified live on Sui testnet</div>
    <div style="font-size:16px;opacity:.8;margin:8px 0 24px">A real AWS Nitro enclave Seal-decrypted a private dataset, computed inside the TEE, and Sui Move verified it on-chain.</div>
    <table style="border-collapse:collapse;font-size:14px;background:#0c2230;border-radius:12px;overflow:hidden">
      ${row("Confidential compute result", "{ columnMeans_0: 4, columnMeans_1: 5, columnMeans_2: 6, n: 3 } — computed inside the enclave")}
      ${row("register_derivative_attested (verify ✓)", TX)}
      ${row("register_enclave (AWS-root attestation ✓)", REGENC)}
      ${row("Enclave&lt;REEF&gt; object", ENCLAVE)}
      ${row("Encrypted dataset (Seal + Walrus)", DATASET)}
      ${row("Reef Move package", PKG)}
    </table>
    <div style="margin-top:26px;font-size:15px;opacity:.85">Walrus · Seal · Sui Move · Tatum &nbsp;—&nbsp; plus a real, on-chain-verified TEE. <b style="color:#2bd1c4">Not a simulation.</b></div>
  </div></body></html>`;
}

main().catch((e) => { console.error(e); process.exit(1); });
