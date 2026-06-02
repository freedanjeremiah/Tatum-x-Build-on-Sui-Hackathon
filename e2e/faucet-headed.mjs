import { chromium } from "playwright";
const ADDR = "0x29bCb9811A60434514c245629DCE2FE4843E3C50";
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ctx = await chromium.launchPersistentContext("C:/Users/freed/OneDrive/Desktop/CDR-hackathon/verify/.cf-profile", {
  headless: false,
  viewport: { width: 1280, height: 900 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
});
const p = ctx.pages()[0] || (await ctx.newPage());
p.on("dialog", (d) => d.accept().catch(() => {}));
try {
  await p.goto("https://aeneid.faucet.story.foundation/", { waitUntil: "domcontentloaded", timeout: 60000 });
  // give Cloudflare challenge time to auto-clear in a real browser
  for (let i = 0; i < 12; i++) {
    await p.waitForTimeout(2500);
    const t = (await p.textContent("body").catch(() => "")) || "";
    if (!/security verification|Just a moment|Enable JavaScript/i.test(t)) { console.log("challenge cleared @", i); break; }
  }
  await p.screenshot({ path: SHOTS + "faucet-headed-1.png", fullPage: true });
  const body = (await p.textContent("body")) || "";
  console.log("text:", body.replace(/\s+/g, " ").slice(0, 400));
  const input = p.locator("input").first();
  if (await input.count()) { await input.fill(ADDR); console.log("filled address"); }
  const btn = p.locator("button", { hasText: /request|send|claim|get|drip|faucet/i }).first();
  if (await btn.count()) { console.log("btn:", (await btn.textContent())?.trim()); await btn.click(); await p.waitForTimeout(8000); }
  await p.screenshot({ path: SHOTS + "faucet-headed-2.png", fullPage: true });
  console.log("after:", ((await p.textContent("body")) || "").replace(/\s+/g, " ").slice(0, 400));
} catch (e) { console.log("err:", String(e).slice(0, 200)); }
finally { await ctx.close(); }
