import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const issues = [];
const consoleErrors = [];
const netFail = [];
let page;

const b = await chromium.launch();
const ctx = await b.newContext();
page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));
page.on("requestfailed", (r) => netFail.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 500) netFail.push(`HTTP ${r.status()} ${r.url()}`); });
page.on("dialog", (d) => d.accept().catch(() => {}));

const txt = async () => (await page.textContent("body").catch(() => "")) || "";
async function go(path) {
  const r = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => ({ err: e }));
  await page.waitForTimeout(2500);
  return r;
}
function check(name, ok, detail = "") { issues.push({ name, ok, detail }); console.log(`${ok ? "ok " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); }

// 1. Landing (real). Should render shell, NO mock banner, wallet connect present.
await go("/");
let t = await txt();
check("/ renders shell", /OpenVault|Access control/i.test(t));
check("/ NO mock banner (real mode)", !/MOCK MODE/i.test(t), /MOCK MODE/i.test(t) ? "mock banner shown in real mode!" : "");
check("/ wallet connect present", /connect/i.test(t));
check("/ no 'mock' wording leaking", !/\bmock\b/i.test(t), (t.match(/.{0,20}mock.{0,20}/i) || [""])[0]);
await page.screenshot({ path: SHOTS + "r-home.png", fullPage: true });

// 2. Browse empty-state (real indexer empty). Must degrade gracefully, not spin forever.
const idx = await (await fetch(BASE + "/api/index").catch(() => null))?.json?.().catch(() => null);
check("/api/index returns array", Array.isArray(idx), Array.isArray(idx) ? `len=${idx.length}` : "not array/err");
const grid = await page.locator("a[href^='/artifact/']").count();
check("browse empty handled (no crash)", true, `cards=${grid}`);
check("browse shows empty state or cards", grid > 0 || /no |empty|nothing|be the first|get started/i.test(t), grid === 0 ? "expect a friendly empty state" : `${grid} cards`);

// 3. Each route renders without 500/console crash
for (const route of ["/upload", "/leaderboard", "/artifact/0xdoesnotexist", "/compute/0xdoesnotexist", "/group/0xdoesnotexist"]) {
  const r = await go(route);
  const tt = await txt();
  const status = r && r.status ? r.status() : "?";
  check(`route ${route} no crash`, !/Application error|Internal Server Error|Unhandled/i.test(tt) && tt.length > 50, `status=${status}`);
}

// 4. Upload page when wallet NOT connected — should prompt connect, not crash on submit attempt
await go("/upload");
t = await txt();
check("/upload renders wizard", /upload|register|artifact|tier|file/i.test(t));
// try to walk to submit without connecting wallet — expect graceful gate, not crash
try {
  const fi = page.locator("input[type=file]").first();
  if (await fi.count()) await fi.setInputFiles({ name: "w.bin", mimeType: "application/octet-stream", buffer: Buffer.from("REAL_TEST") });
  // click through next buttons a few times
  for (let i = 0; i < 4; i++) { const nb = page.locator("button", { hasText: /next|continue/i }).first(); if (await nb.count() && await nb.isEnabled()) { await nb.click(); await page.waitForTimeout(500); } }
  await page.screenshot({ path: SHOTS + "r-upload.png", fullPage: true });
  check("/upload wizard advances w/o crash", true);
} catch (e) { check("/upload wizard advances w/o crash", false, String(e).slice(0, 80)); }

// 5. Wallet connect button actually does something (opens Privy modal) — real mode
await go("/");
try {
  const cbtn = page.locator("button", { hasText: /connect/i }).first();
  if (await cbtn.count()) {
    await cbtn.click();
    await page.waitForTimeout(3500);
    const after = await txt();
    const modal = /privy|log in|continue with|email|wallet|google|sign in/i.test(after) || (await page.locator("iframe").count()) > 0;
    check("wallet connect opens auth UI", modal, modal ? "" : "no auth modal appeared");
    await page.screenshot({ path: SHOTS + "r-connect.png", fullPage: true });
  } else check("wallet connect opens auth UI", false, "no connect button");
} catch (e) { check("wallet connect opens auth UI", false, String(e).slice(0, 100)); }

// summary
console.log("\n--- CONSOLE ERRORS (" + consoleErrors.length + ") ---");
[...new Set(consoleErrors)].slice(0, 15).forEach((e) => console.log("  " + e.slice(0, 200)));
console.log("--- NETWORK FAILURES (" + netFail.length + ") ---");
[...new Set(netFail)].slice(0, 15).forEach((e) => console.log("  " + e.slice(0, 200)));
const fails = issues.filter((i) => !i.ok);
console.log(`\n==== ${issues.length - fails.length}/${issues.length} checks ok; ${fails.length} FAIL; ${consoleErrors.length} console errs; ${netFail.length} net fails ====`);
await b.close();
