import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const errs = [];
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("dialog", (d) => d.accept().catch(() => {}));
const txt = async () => (await p.textContent("body")) || "";
const log = (s) => console.log(s);

await p.goto(BASE + "/upload", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);

// Step through the wizard, clicking the most likely "next/continue" controls and filling fields as they appear.
async function fill(sel, val) { const l = p.locator(sel).first(); if (await l.count()) { await l.fill(val); return true; } return false; }
async function clickText(re) {
  const btn = p.locator("button", { hasText: re }).first();
  if (await btn.count() && await btn.isEnabled()) { await btn.click(); await p.waitForTimeout(900); return true; }
  return false;
}

// Step 1: file + modality. Upload a small in-memory file.
const fileInput = p.locator("input[type=file]").first();
if (await fileInput.count()) {
  await fileInput.setInputFiles({ name: "weights.bin", mimeType: "application/octet-stream", buffer: Buffer.from("FAKE_MODEL_WEIGHTS_v1") });
  log("set file ✓");
}
// pick model modality if a control exists
await clickText(/^model$/i);
await clickText(/next|continue/i);

// Step 2: details
await fill("input[name=title], input[placeholder*='title' i]", "VerifyBot-7B");
await fill("textarea, textarea[placeholder*='desc' i]", "A model published by the automated verification flow.");
await fill("input[placeholder*='tag' i], input[name=tags]", "nlp, verify");
await fill("input[placeholder*='creator' i], input[name=creators]", "OpenVault QA");
await clickText(/next|continue/i);

// Step 3: tier -> gated
await clickText(/^gated$/i);
await fill("input[placeholder*='fee' i], input[name=fee]", "1");
await fill("input[placeholder*='rev' i], input[name=revshare], input[placeholder*='share' i]", "5");
await clickText(/next|continue/i);

// Step 4: lineage -> skip (no parent)
await clickText(/skip|no|next|continue/i);

// Step 5: review -> submit
await p.waitForTimeout(600);
await clickText(/publish|submit|register|upload|create/i);
await p.waitForTimeout(6000);

const t = await txt();
await p.screenshot({ path: SHOTS + "12-upload-result.png", fullPage: true });
const success = /(0x[0-9a-fA-F]{6,})|registered|published|success|view artifact|ip asset|ipId/i.test(t);
log("Upload wizard completed → success indicators: " + success);
log("page tail: " + t.replace(/\s+/g, " ").slice(-400));
log("pageerrors: " + (errs.length ? errs.slice(0,3).join(" | ") : "none"));
log(success && errs.length === 0 ? "RESULT: PASS" : "RESULT: NEEDS_REVIEW");
await b.close();
