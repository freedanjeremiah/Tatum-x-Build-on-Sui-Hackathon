import { chromium } from "playwright";
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ctx = await chromium.launchPersistentContext("C:/Users/freed/OneDrive/Desktop/CDR-hackathon/verify/.privy-profile", {
  headless: false,
  viewport: { width: 1280, height: 900 },
});
const p = ctx.pages()[0] || (await ctx.newPage());
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
let connect = 0, lastTxt = "";
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(2000);
  connect = await p.locator("button", { hasText: /^connect$/i }).count();
  lastTxt = ((await p.locator("header").textContent().catch(() => "")) || "").replace(/\s+/g, " ").trim().slice(-30);
  console.log(`t=${(i + 1) * 2}s connectBtn=${connect} header="…${lastTxt}"`);
  if (connect) break;
}
await p.screenshot({ path: SHOTS + "connect-headed.png", fullPage: true });
if (connect) {
  // open the login modal
  await p.locator("button", { hasText: /^connect$/i }).first().click();
  await p.waitForTimeout(4000);
  const modal = /log in|continue with|email|google|wallet|privy/i.test((await p.textContent("body")) || "") || (await p.locator("iframe").count()) > 0;
  console.log("login modal opened:", modal);
  await p.screenshot({ path: SHOTS + "connect-modal.png", fullPage: true });
}
console.log("console/page errors:", errs.length ? [...new Set(errs)].slice(0,5) : "none");
console.log(connect ? "RESULT: CONNECT BUTTON PRESENT ✓" : "RESULT: still no connect button");
await ctx.close();
