import { chromium } from "playwright";
const ADDR = "0x29bCb9811A60434514c245629DCE2FE4843E3C50";
const SHOTS = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const b = await chromium.launch();
const p = await b.newPage();
p.on("dialog", (d) => d.accept().catch(() => {}));
try {
  await p.goto("https://aeneid.faucet.story.foundation/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: SHOTS + "faucet-1.png", fullPage: true });
  const body = (await p.textContent("body")) || "";
  console.log("page text (first 600):", body.replace(/\s+/g, " ").slice(0, 600));
  // find an address input
  const input = p.locator("input[type=text], input:not([type]), input[placeholder*='0x' i], input[placeholder*='address' i]").first();
  if (await input.count()) {
    await input.fill(ADDR);
    console.log("filled address");
  } else {
    console.log("NO address input found (likely wallet-connect or login required)");
  }
  await p.waitForTimeout(800);
  const btn = p.locator("button", { hasText: /request|send|claim|get|faucet|drip/i }).first();
  if (await btn.count()) {
    console.log("clicking request button:", (await btn.textContent())?.trim());
    await btn.click();
    await p.waitForTimeout(6000);
  } else {
    console.log("NO request button found");
  }
  await p.screenshot({ path: SHOTS + "faucet-2.png", fullPage: true });
  const after = (await p.textContent("body")) || "";
  console.log("after text (first 600):", after.replace(/\s+/g, " ").slice(0, 600));
} catch (e) {
  console.log("faucet error:", String(e).slice(0, 200));
} finally {
  await b.close();
}
