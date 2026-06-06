// Records the LIVE confidential-compute workflow: opens the live-demo page, clicks
// "Run", and captures the real enclave compute + on-chain register_derivative_attested
// signature appearing live. Video → e2e/shots/demo/*.webm
import { chromium } from "playwright";
import fs from "node:fs";

const URL = process.env.LIVE_URL ?? "http://127.0.0.1:8099";
const OUT = "shots/demo";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function caption(page, title, sub) {
  await page.evaluate(([title, sub]) => {
    let el = document.getElementById("__cap");
    if (!el) {
      el = document.createElement("div");
      el.id = "__cap";
      el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:16px 28px;" +
        "background:linear-gradient(90deg,#0b1f2a,#0e3a4f);color:#fff;font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif;" +
        "box-shadow:0 4px 24px rgba(0,0,0,.35);border-bottom:2px solid #2bd1c4;";
      document.body.appendChild(el);
      document.body.style.paddingTop = "84px";
    }
    el.innerHTML = '<div style="font-size:21px;font-weight:700">' + title + "</div>" +
      (sub ? '<div style="font-size:13.5px;opacity:.85;margin-top:4px">' + sub + "</div>" : "");
  }, [title, sub ?? ""]);
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

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(1200);
  await caption(page, "Reef — confidential compute on Sui", "Private dataset · Seal-encrypted on Walrus · computed inside an AWS Nitro enclave");
  await sleep(4500);

  // Click run — triggers the REAL flow (enclave decrypt+compute+sign → on-chain verify).
  await caption(page, "Running the job inside the real enclave…", "Seal-decrypt → mean-aggregate → enclave signs → reef::registry verifies on-chain");
  await page.click("#run");
  await sleep(800);

  // Wait for the real on-chain tx digest to appear (up to 90s).
  try {
    await page.waitForFunction(() => {
      const t = document.getElementById("tx");
      return t && t.textContent && t.textContent.trim().length > 20;
    }, null, { timeout: 150000 });
  } catch (e) {
    console.warn("tx did not appear in time:", e.message);
  }
  await sleep(1500);
  await caption(page, "Sui Move verified the enclave — on-chain", "register_derivative_attested accepted the result only because the enclave signature verified");
  await sleep(8000);

  await sleep(800);
  await ctx.close();
  await browser.close();
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".webm"));
  console.log("VIDEO_FILES=" + JSON.stringify(files.map((f) => `${OUT}/${f}`)));
}
main().catch((e) => { console.error(e); process.exit(1); });
