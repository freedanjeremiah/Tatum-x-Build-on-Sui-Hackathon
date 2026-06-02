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
async function clickText(re, which = "first") {
  const btn = p.locator("button", { hasText: re });
  const el = which === "last" ? btn.last() : btn.first();
  if ((await el.count()) && (await el.isEnabled())) { await el.click(); await p.waitForTimeout(1000); return true; }
  return false;
}
async function fillAllText(values) {
  // fill visible text inputs + textareas in DOM order
  const inputs = p.locator("main input[type=text], main input:not([type]), input[type=text], textarea");
  const n = await inputs.count();
  let vi = 0;
  for (let i = 0; i < n && vi < values.length; i++) {
    const el = inputs.nth(i);
    if (await el.isVisible().catch(() => false)) { await el.fill(values[vi++]); }
  }
  return vi;
}

await p.goto(BASE + "/upload", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2000);

// Step 1 Artifact: file
const fi = p.locator("input[type=file]").first();
if (await fi.count()) { await fi.setInputFiles({ name: "weights.bin", mimeType: "application/octet-stream", buffer: Buffer.from("FAKE_MODEL_WEIGHTS_v1") }); log("file set ✓"); }
await clickText(/^model$/i);
await clickText(/next|continue/i);
log("step after artifact: " + (await p.locator("text=/Details/i").count() ? "Details" : "?"));

// Step 2 Details: fill title, description, tags, creators positionally
const filled = await fillAllText(["VerifyBot-7B", "Published by the automated A1 verification flow.", "nlp, verify", "OpenVault QA"]);
log("details fields filled: " + filled);
await clickText(/next|continue/i);

// Step 3 Tier: choose gated (card contains extra text → click by partial)
const gatedCard = p.locator("button, [role=button]", { hasText: /gated/i }).first();
if (await gatedCard.count()) { await gatedCard.click(); await p.waitForTimeout(800); log("gated card selected ✓"); }
await fillAllText(["1", "5"]); // fee, revshare now visible
await clickText(/next|continue/i);

// Step 4 Lineage: choose "no parent" / skip, then continue
await clickText(/no\b|skip|not a derivative|standalone|original/i);
await clickText(/next|continue/i);

// Step 5 Review: submit
await p.waitForTimeout(600);
await p.screenshot({ path: SHOTS + "13-upload-review.png", fullPage: true });
const submitted = await clickText(/publish|register|submit|upload|create|confirm/i, "last");
log("submit clicked: " + submitted);
await p.waitForTimeout(7000);

const t = await txt();
await p.screenshot({ path: SHOTS + "14-upload-done.png", fullPage: true });
const hasIpId = /0x[0-9a-fA-F]{8,}/.test(t);
const hasSuccessWord = /registered|published|live|success|view artifact|your artifact|uploaded/i.test(t);
const hasTxLink = (await p.locator("a[href*='storyscan'], a[href*='explorer.story']").count()) > 0;
log("RESULT hasIpId=" + hasIpId + " successWord=" + hasSuccessWord + " txLink=" + hasTxLink + " errs=" + errs.length);
log("tail: " + t.replace(/\s+/g, " ").slice(-300));
log((hasIpId || hasSuccessWord) && hasTxLink && errs.length === 0 ? "OVERALL: PASS" : "OVERALL: REVIEW");
await b.close();
